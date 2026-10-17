<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * When emails go to the log (MAIL_MAILER=log, the default for running locally), the
 * raw email in the log is hard to read: links are encoded and wrapped. This writes one
 * plain line per email so the link can be copied straight from storage/logs/laravel.log:
 *
 *   Email link for kamran@nexora.example (Invite): http://localhost:3000/accept-invite?...
 */
class EmailLink
{
    public static function log(string $to, string $what, string $url): void
    {
        if (config('mail.default') === 'log') {
            Log::info("Email link for {$to} ({$what}): {$url}");
        }
    }
}
