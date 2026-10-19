<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * php artisan nexora:send-test-email, with the "array" mailer that tests use: the email is
 * kept in memory, nothing is sent.
 */
class SendTestEmailTest extends TestCase
{
    public function test_the_test_email_goes_to_the_given_address(): void
    {
        $this->artisan('nexora:send-test-email', ['to' => 'eman@nexora.example'])
            ->expectsOutput('Mailer: array')
            ->expectsOutput('Sent to eman@nexora.example')
            ->assertExitCode(0);

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $email = $messages->first()->getOriginalMessage();
        $this->assertSame('eman@nexora.example', $email->getTo()[0]->getAddress());
        $this->assertStringContainsString('email delivery works', $email->getTextBody());
    }

    public function test_an_invalid_address_is_refused(): void
    {
        $this->artisan('nexora:send-test-email', ['to' => 'not-an-email'])->assertExitCode(1);

        $this->assertCount(0, Mail::mailer('array')->getSymfonyTransport()->messages());
    }
}
