<?php

namespace Tests\Feature;

use App\Listeners\SkipReservedRecipients;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

/**
 * Emails to reserved test domains (.example, .test, .invalid, .localhost) aren't sent, so
 * the demo accounts don't cause bounces when real delivery is on. Uses the "array" mailer
 * that tests run with: messages are kept in memory, nothing leaves the computer.
 */
class ReservedEmailDomainTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function sent()
    {
        return Mail::mailer('array')->getSymfonyTransport()->messages();
    }

    private function invite(string $email): void
    {
        $huma = User::where('email', 'huma@nexora.example')->firstOrFail();
        $this->actingAs($huma)->postJson('/api/team/invite', ['name' => 'Test Person', 'email' => $email, 'role' => 'sales_rep'])->assertCreated();
    }

    public function test_an_invite_to_a_reserved_domain_sends_nothing_but_logs_the_link(): void
    {
        Log::spy();

        $this->invite('x@nexora.example');

        $this->assertCount(0, $this->sent());
        Log::shouldHaveReceived('info')->withArgs(fn ($line) => Str::startsWith($line, 'Email link for x@nexora.example (Invite): http'))->once();
    }

    public function test_an_invite_to_a_normal_address_is_sent(): void
    {
        $this->invite('new.person@gmail.com');

        $this->assertCount(1, $this->sent());
        $this->assertSame('new.person@gmail.com', $this->sent()->first()->getOriginalMessage()->getTo()[0]->getAddress());
    }

    public function test_only_reserved_recipients_are_dropped_from_a_mixed_email(): void
    {
        Mail::raw('Hello', fn ($m) => $m->to(['real@gmail.com', 'demo@nexora.example'])->cc('team@acme.test')->bcc('boss@gmail.com')->subject('Mixed'));

        $this->assertCount(1, $this->sent());
        $email = $this->sent()->first()->getOriginalMessage();
        $this->assertSame(['real@gmail.com'], array_map(fn ($a) => $a->getAddress(), $email->getTo()));
        $this->assertSame([], $email->getCc());
        $this->assertSame(['boss@gmail.com'], array_map(fn ($a) => $a->getAddress(), $email->getBcc()));
    }

    public function test_the_log_mailer_still_writes_the_whole_email(): void
    {
        $email = (new Email)->to('demo@nexora.example')->subject('Logged')->text('Hello');

        config(['mail.default' => 'log']);
        $this->assertNull((new SkipReservedRecipients)->handle(new MessageSending($email)), 'the log mailer delivers nothing, so the email is kept');

        config(['mail.default' => 'smtp']);
        $this->assertFalse((new SkipReservedRecipients)->handle(new MessageSending($email)), 'with real delivery it is cancelled');
    }
}
