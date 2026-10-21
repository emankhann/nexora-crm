<?php

namespace App\Console\Commands;

use App\Support\EmailLink;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sends one short email to check that email delivery works with the current MAIL_ settings:
 *
 *   php artisan nexora:send-test-email you@example.com
 *
 * Prints which mailer was used. On failure it prints a short error and the likely fix, never
 * the password or the mail settings.
 */
class SendTestEmail extends Command
{
    protected $signature = 'nexora:send-test-email {to : The address to send the test email to}';

    protected $description = 'Send a test email to check that email delivery works';

    public function handle(): int
    {
        $to = (string) $this->argument('to');
        $mailer = (string) config('mail.default');

        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("\"{$to}\" isn't a valid email address.");

            return self::FAILURE;
        }

        try {
            Mail::raw('Nexora CRM test email: if you can read this, email delivery works.', function ($message) use ($to) {
                $message->to($to)->subject('Nexora CRM test email');
            });
        } catch (Throwable $e) {
            $this->error("The test email could not be sent (mailer: {$mailer}).");
            // The first line of the error is enough to recognise the problem.
            $this->line('  '.strtok(trim($e->getMessage()), "\n"));
            $this->line($this->hint($e->getMessage()));

            return self::FAILURE;
        }

        $this->info("Mailer: {$mailer}");
        $this->info("Sent to {$to}");
        if ($mailer === 'log') {
            $this->line('MAIL_MAILER is "log", so the email was written to storage/logs/laravel.log, not delivered.');
        } elseif (EmailLink::isReserved($to)) {
            $this->line("{$to} is on a reserved test domain, so it wasn't really sent. Use a real address to test delivery.");
        }

        return self::SUCCESS;
    }

    private function hint(string $error): string
    {
        $gmail = str_contains((string) config('mail.mailers.smtp.host'), 'gmail');

        if (preg_match('/\b535\b|authenticat|username and password/i', $error)) {
            return $gmail
                ? 'Gmail refused the login: check MAIL_USERNAME and the app password, and that 2-Step Verification is on.'
                : 'The mail server refused the login: check MAIL_USERNAME and MAIL_PASSWORD.';
        }
        if (preg_match('/connection|timed out|resolve|getaddrinfo/i', $error)) {
            return 'Could not reach the mail server: check MAIL_HOST and MAIL_PORT, and your internet connection.';
        }

        return $gmail
            ? 'Check MAIL_USERNAME and the app password, and that 2-Step Verification is on. Run php artisan config:clear after changing .env.'
            : 'Check the MAIL_ settings in backend/.env, then run php artisan config:clear.';
    }
}
