<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * When emails go to the log (MAIL_MAILER=log, the default for running locally), the
 * raw email in the log is hard to read: links are encoded and wrapped. This writes one
 * plain line per email so the link can be copied straight from storage/logs/laravel.log:
 *
 *   Email link for kamran@nexora.example (Invite): http://localhost:3000/accept-invite?...
 *
 * The line is also written when real email delivery is on but the address is on a reserved
 * test domain (the demo accounts), because those emails aren't sent (see SkipReservedRecipients).
 */
class EmailLink
{
    /** Top-level domains reserved for testing (RFC 2606): no email to them can ever arrive. */
    private const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost'];

    /** Second-level domains RFC 2606 also reserves for examples. */
    private const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

    public static function log(string $to, string $what, string $url): void
    {
        if (config('mail.default') === 'log' || self::isReserved($to)) {
            Log::info("Email link for {$to} ({$what}): {$url}");
        }
    }

    /** True for addresses like huma@nexora.example or someone@example.com. */
    public static function isReserved(string $email): bool
    {
        $domain = strtolower(substr((string) strrchr($email, '@'), 1));
        if ($domain === '') {
            return false;
        }
        foreach ([...self::RESERVED_TLDS, ...self::RESERVED_DOMAINS] as $reserved) {
            if ($domain === $reserved || str_ends_with($domain, ".{$reserved}")) {
                return true;
            }
        }

        return false;
    }
}
