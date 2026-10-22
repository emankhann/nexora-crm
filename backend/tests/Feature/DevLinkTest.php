<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * On a computer without email set up (local, MAIL_MAILER=log), the invite and password-reset
 * links come back in the API response as devLink, so the app can show them. Never anywhere else.
 */
class DevLinkTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function as(string $env, string $mailer): void
    {
        $this->app['env'] = $env;
        config(['mail.default' => $mailer]);
    }

    private function huma(): User
    {
        return User::where('email', 'huma@nexora.example')->firstOrFail();
    }

    private function invite(string $email)
    {
        return $this->actingAs($this->huma())->postJson('/api/team/invite', ['name' => 'Test Person', 'email' => $email, 'role' => 'sales_rep'])->assertCreated();
    }

    public function test_locally_with_the_log_mailer_the_links_come_back_as_dev_link(): void
    {
        $this->as('local', 'log');
        $frontend = config('app.frontend_url');

        $invite = $this->invite('ali@nexora.example');
        $this->assertStringStartsWith("{$frontend}/accept-invite?token=", $invite->json('devLink'));
        $this->assertStringContainsString('email=ali%40nexora.example', $invite->json('devLink'));

        // Resending makes a new link, and that new one comes back.
        $id = $invite->json('data.id');
        $resent = $this->actingAs($this->huma())->postJson("/api/team/{$id}/resend")->assertOk();
        $this->assertStringStartsWith("{$frontend}/accept-invite?token=", $resent->json('devLink'));
        $this->assertNotSame($invite->json('devLink'), $resent->json('devLink'));

        $reset = $this->postJson('/api/forgot-password', ['email' => 'sana@nexora.example'])->assertOk();
        $this->assertStringStartsWith("{$frontend}/reset-password?token=", $reset->json('devLink'));
    }

    public function test_an_unknown_or_pending_email_gets_exactly_the_same_forgot_password_answer(): void
    {
        $this->as('local', 'log');
        $same = ['message' => 'If that email has an account, a reset link is on its way.'];

        $this->postJson('/api/forgot-password', ['email' => 'nobody@nexora.example'])->assertOk()->assertExactJson($same);
        $this->postJson('/api/forgot-password', ['email' => 'kamran@nexora.example'])->assertOk()->assertExactJson($same); // pending invite
    }

    public function test_no_dev_link_in_production(): void
    {
        $this->as('production', 'log');

        $this->invite('ali@nexora.example')->assertJsonMissingPath('devLink');
        $this->postJson('/api/forgot-password', ['email' => 'sana@nexora.example'])->assertOk()->assertJsonMissingPath('devLink');
    }

    public function test_no_dev_link_with_a_real_mailer(): void
    {
        $this->as('local', 'smtp');
        Mail::fake(); // the emails are built (so a link exists) but nothing is sent

        $this->invite('ali@nexora.example')->assertJsonMissingPath('devLink');
        $this->postJson('/api/forgot-password', ['email' => 'sana@nexora.example'])->assertOk()->assertJsonMissingPath('devLink');
    }
}
