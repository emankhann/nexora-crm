<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\User;
use App\Notifications\LeadAssigned;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * "Email the new owner" in the Assign owner dialog: POST /api/leads/bulk with
 * action assign and notify. Notifications are faked, so nothing is sent.
 */
class LeadAssignedEmailTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    private function assign(User $by, array $leadIds, ?User $to, bool $notify)
    {
        return $this->actingAs($by)->postJson('/api/leads/bulk', ['action' => 'assign', 'ids' => $leadIds, 'owner_id' => $to?->id, 'notify' => $notify])->assertOk();
    }

    public function test_assigning_with_notify_emails_the_new_owner_once(): void
    {
        Notification::fake();
        $omar = $this->user('omar@nexora.example');
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail(); // Sana's

        $this->assign($this->user('huma@nexora.example'), [$lead->id], $omar, true);

        Notification::assertSentToTimes($omar, LeadAssigned::class, 1);
        Notification::assertSentTo($omar, LeadAssigned::class, function (LeadAssigned $n) use ($omar, $lead) {
            $mail = $n->toMail($omar);

            return $n->leads->pluck('id')->all() === [$lead->id]
                && $mail->subject === "{$lead->name} was assigned to you"
                && $mail->actionUrl === config('app.frontend_url')."/leads/{$lead->id}";
        });
        Notification::assertCount(1);
    }

    public function test_notify_false_sends_nothing(): void
    {
        Notification::fake();
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail();

        $this->assign($this->user('huma@nexora.example'), [$lead->id], $this->user('omar@nexora.example'), false);

        Notification::assertNothingSent();
        $this->assertSame($this->user('omar@nexora.example')->id, $lead->fresh()->owner_id);
    }

    public function test_assigning_to_yourself_or_unassigning_sends_nothing(): void
    {
        Notification::fake();
        $huma = $this->user('huma@nexora.example');
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail();

        $this->assign($huma, [$lead->id], $huma, true);
        $this->assign($huma, [$lead->id], null, true);

        Notification::assertNothingSent();
        $this->assertNull($lead->fresh()->owner_id);
    }

    public function test_bulk_assigning_three_leads_sends_one_email_listing_all_three(): void
    {
        Notification::fake();
        $sana = $this->user('sana@nexora.example');
        $leads = Lead::whereNot('owner_id', $sana->id)->orWhereNull('owner_id')->orderBy('id')->take(3)->get();
        $this->assertCount(3, $leads);

        $this->assign($this->user('huma@nexora.example'), $leads->pluck('id')->all(), $sana, true);

        Notification::assertSentToTimes($sana, LeadAssigned::class, 1);
        Notification::assertSentTo($sana, LeadAssigned::class, function (LeadAssigned $n) use ($sana, $leads) {
            $mail = $n->toMail($sana);
            $text = implode("\n", $mail->introLines);

            return $mail->subject === '3 leads assigned to you'
                && $mail->actionUrl === config('app.frontend_url').'/leads'
                && $leads->every(fn (Lead $l) => str_contains($text, $l->name) && str_contains($text, $l->company) && str_contains($text, "score {$l->score}"));
        });
    }
}
