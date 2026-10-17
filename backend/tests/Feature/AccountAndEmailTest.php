<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Deal;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskReminder;
use App\Notifications\TeamInvite;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Password reset, team invites, changing your own password, deleting a customer
 * and task reminder emails. Emails are faked, so nothing is sent.
 */
class AccountAndEmailTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    /* ----------------------------- Password reset ----------------------------- */

    public function test_forgot_password_emails_active_users_only_and_answers_the_same_way(): void
    {
        Notification::fake();

        $known = $this->postJson('/api/forgot-password', ['email' => 'sana@nexora.example'])->assertOk()->json('message');
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@nexora.example'])->assertOk()->json('message');
        $this->postJson('/api/forgot-password', ['email' => 'kamran@nexora.example'])->assertOk(); // pending invite

        $this->assertSame($known, $unknown);
        Notification::assertSentTo($this->user('sana@nexora.example'), ResetPassword::class);
        Notification::assertNotSentTo($this->user('kamran@nexora.example'), ResetPassword::class);
    }

    public function test_a_reset_link_sets_a_new_password_once_and_expires(): void
    {
        Notification::fake();
        $sana = $this->user('sana@nexora.example');
        $this->postJson('/api/forgot-password', ['email' => $sana->email]);
        $token = null;
        Notification::assertSentTo($sana, ResetPassword::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $reset = fn (string $password) => $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => $sana->email, 'password' => $password, 'password_confirmation' => $password,
        ]);

        $reset('short')->assertStatus(422)->assertJsonValidationErrors('password');
        $reset('newpass123')->assertOk();
        $this->assertTrue(Hash::check('newpass123', $sana->fresh()->password));
        $reset('another123')->assertStatus(422)->assertJsonValidationErrors('token'); // used once already

        // A fresh link stops working after 60 minutes.
        $this->travel(2)->minutes(); // Laravel allows one reset email per minute
        $this->postJson('/api/forgot-password', ['email' => $sana->email]);
        Notification::assertSentTo($sana, ResetPassword::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });
        $this->travel(61)->minutes();
        $reset('another123')->assertStatus(422)->assertJsonValidationErrors('token');
    }

    /* -------------------------------- Invites -------------------------------- */

    public function test_an_invited_person_can_join_from_the_link_and_is_signed_in(): void
    {
        Notification::fake();
        $huma = $this->user('huma@nexora.example');
        $this->actingAs($huma)->postJson('/api/team/invite', ['name' => 'Ali Raza', 'email' => 'ali@nexora.example', 'role' => 'sales_rep'])->assertCreated();

        $ali = $this->user('ali@nexora.example');
        $token = null;
        Notification::assertSentTo($ali, TeamInvite::class, function (TeamInvite $n) use (&$token, $ali) {
            $token = $n->token;

            return str_contains($n->url($ali), '/accept-invite?') && $n->invitedBy === 'Huma Khan';
        });

        $this->postJson('/api/invites/check', ['token' => 'wrong', 'email' => $ali->email])->assertStatus(422)->assertJsonValidationErrors('token');
        $this->postJson('/api/invites/check', ['token' => $token, 'email' => $ali->email])->assertOk()->assertJsonPath('role', 'Sales rep');

        $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/invites/accept', [
            'token' => $token, 'email' => $ali->email, 'password' => 'welcome123', 'password_confirmation' => 'welcome123',
        ])->assertOk()->assertJsonPath('data.status', 'active');

        // The API signs them in on the session ("web") guard, which Sanctum reads on the next
        // request. (The default guard here still holds Huma from actingAs() above.)
        $this->assertAuthenticatedAs($ali->fresh(), 'web');
        $this->assertSame('active', $ali->fresh()->status->value);
        // The link can't be used twice. Asked as a new visitor: without this the Origin header
        // set above would make the test reuse a browser session that actingAs() muddled.
        $this->flushHeaders()->postJson('/api/invites/check', ['token' => $token, 'email' => $ali->email])->assertStatus(422);
    }

    public function test_invite_links_expire_after_7_days_and_resending_replaces_the_link(): void
    {
        Notification::fake();
        $huma = $this->user('huma@nexora.example');
        $this->actingAs($huma)->postJson('/api/team/invite', ['name' => 'Ali Raza', 'email' => 'ali@nexora.example', 'role' => 'sales_rep']);
        $ali = $this->user('ali@nexora.example');
        $tokens = [];
        Notification::assertSentTo($ali, TeamInvite::class, function (TeamInvite $n) use (&$tokens) {
            $tokens[] = $n->token;

            return true;
        });

        $this->actingAs($huma)->postJson("/api/team/{$ali->id}/resend")->assertOk();
        $tokens = [];
        Notification::assertSentTo($ali, TeamInvite::class, function (TeamInvite $n) use (&$tokens) {
            $tokens[] = $n->token;

            return true;
        });
        [$first, $second] = $tokens;
        $this->postJson('/api/invites/check', ['token' => $first, 'email' => $ali->email])->assertStatus(422);
        $this->postJson('/api/invites/check', ['token' => $second, 'email' => $ali->email])->assertOk();

        $this->travel(8)->days();
        $this->postJson('/api/invites/check', ['token' => $second, 'email' => $ali->email])->assertStatus(422);
    }

    /* ----------------------------- Own password ----------------------------- */

    public function test_changing_your_own_password_needs_the_current_one(): void
    {
        $omar = $this->user('omar@nexora.example');

        $this->actingAs($omar)->putJson('/api/me/password', [
            'current_password' => 'wrong', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->actingAs($omar)->putJson('/api/me/password', [
            'current_password' => 'demo1234', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('newpass123', $omar->fresh()->password));
    }

    public function test_each_form_has_its_own_rate_limit(): void
    {
        Notification::fake();

        // Six failed sign-ins (the limit is 10) must not use up forgot-password's limit of 5.
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/login', ['email' => 'nobody@nexora.example', 'password' => 'wrong']);
        }
        $this->postJson('/api/forgot-password', ['email' => 'sana@nexora.example'])->assertOk();

        // Using the app normally must not use up the change-password limit of 10.
        $omar = $this->user('omar@nexora.example');
        for ($i = 0; $i < 11; $i++) {
            $this->actingAs($omar)->getJson('/api/me')->assertOk();
        }
        $this->actingAs($omar)->putJson('/api/me/password', [
            'current_password' => 'wrong', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertStatus(422);
    }

    /* --------------------------- Deleting a customer --------------------------- */

    public function test_only_admins_delete_customers_and_their_deals_are_unlinked_not_lost(): void
    {
        $customer = Customer::where('name', 'Orbit Studios')->firstOrFail();
        $dealIds = Deal::where('customer_id', $customer->id)->pluck('id');
        $this->assertNotEmpty($dealIds);

        $this->actingAs($this->user('omar@nexora.example'))->deleteJson("/api/customers/{$customer->id}")->assertForbidden();
        $this->actingAs($this->user('huma@nexora.example'))->deleteJson("/api/customers/{$customer->id}")->assertNoContent();

        $this->assertSoftDeleted($customer);
        $this->assertSame($dealIds->count(), Deal::whereIn('id', $dealIds)->whereNull('customer_id')->count());
        $this->assertSame(0, Task::where('customer_id', $customer->id)->whereNull('completed_at')->count());
    }

    /* ---------------------------- Reminder emails ---------------------------- */

    public function test_task_reminder_emails_go_out_once_when_their_time_comes(): void
    {
        Notification::fake();
        $sana = $this->user('sana@nexora.example');
        Task::query()->update(['remind_by_email' => false]); // ignore the demo tasks
        $task = Task::create([
            'title' => 'Call Harbor Dental', 'type' => 'call', 'priority' => 'high', 'reminder' => '1h', 'remind_by_email' => true,
            'due_at' => now()->addMinutes(90), 'assigned_to' => $sana->id, 'created_by' => $sana->id,
        ]);

        $this->artisan('nexora:send-task-reminders')->assertSuccessful();
        Notification::assertNothingSent(); // 90 minutes away; the 1-hour reminder isn't due yet

        $this->travel(31)->minutes();
        $this->artisan('nexora:send-task-reminders')->assertSuccessful();
        $this->artisan('nexora:send-task-reminders')->assertSuccessful();
        Notification::assertSentToTimes($sana, TaskReminder::class, 1);

        // Moving the due time arms the reminder again.
        // Reload first, like the app does: the command marked the reminder as sent in the database.
        $task->refresh()->update(['due_at' => now()->addMinutes(30)]);
        $this->artisan('nexora:send-task-reminders')->assertSuccessful();
        Notification::assertSentToTimes($sana, TaskReminder::class, 2);
    }
}
