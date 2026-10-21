<?php

namespace App\Listeners;

use App\Support\EmailLink;
use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Address;

/**
 * Doesn't send emails to reserved test domains (huma@nexora.example and the other demo
 * accounts). With real delivery on (for example Gmail), they would only come back as
 * bounces. Reserved recipients are dropped from each email; if none are left, the email
 * isn't sent at all. The readable "Email link for …" line still goes to the log (EmailLink).
 *
 * Registered automatically (Laravel discovers listeners in app/Listeners).
 */
class SkipReservedRecipients
{
    /** Returning false cancels the email; null lets it go ahead. */
    public function handle(MessageSending $event): ?bool
    {
        // The log mailer delivers nothing, so keep the whole email in the log there.
        if (config('mail.default') === 'log') {
            return null;
        }

        $message = $event->message;
        $remaining = 0;

        foreach (['to' => $message->getTo(), 'cc' => $message->getCc(), 'bcc' => $message->getBcc()] as $field => $addresses) {
            $real = array_values(array_filter($addresses, fn (Address $a) => ! EmailLink::isReserved($a->getAddress())));
            if (count($real) !== count($addresses)) {
                $message->getHeaders()->remove($field);
                if ($real) {
                    $message->{$field}(...$real);
                }
            }
            $remaining += count($real);
        }

        return $remaining === 0 ? false : null;
    }
}
