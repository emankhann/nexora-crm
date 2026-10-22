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
 *
 * On a computer without email set up, the invite and password-reset links are also handed
 * back to the app (devLink), so the person testing can open them without reading the log.
 */
class EmailLink
{
    /** Top-level domains reserved for testing (RFC 2606): no email to them can ever arrive. */
    private const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost'];

    /** Second-level domains RFC 2606 also reserves for examples. */
    private const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

    /** Links built during this request, by address and kind, for devLink(). */
    private static array $links = [];

    public static function log(string $to, string $what, string $url): void
    {
        self::$links[strtolower($to)][$what] = $url;

        if (config('mail.default') === 'log' || self::isReserved($to)) {
            Log::info("Email link for {$to} ({$what}): {$url}");
        }
    }

    /**
     * The link just emailed to this address, but only on a local computer whose mailer only
     * writes to the log (nothing was really sent). Null everywhere else: never in production,
     * never with a real mailer. Reading it forgets it.
     */
    public static function devLink(string $to, string $what): ?string
    {
        $url = self::$links[strtolower($to)][$what] ?? null;
        unset(self::$links[strtolower($to)][$what]);

        if (! app()->environment('local') || config('mail.default') !== 'log') {
            return null;
        }

        return $url;
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
