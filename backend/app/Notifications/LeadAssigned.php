<?php

namespace App\Notifications;

use App\Models\Lead;
use App\Support\EmailLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

/**
 * "Leads assigned to you" email, sent when someone assigns leads to another person with
 * "Email the new owner" ticked. One email per assignment, listing every lead in it.
 */
class LeadAssigned extends Notification
{
    use Queueable;

    /** Leads listed by name in the email; the rest are counted. */
    private const LISTED = 20;

    /** @param  Collection<int, Lead>  $leads */
    public function __construct(public Collection $leads, public string $assignedBy) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = $this->leads->count();
        $one = $count === 1 ? $this->leads->first() : null;
        $url = config('app.frontend_url').($one ? "/leads/{$one->id}" : '/leads');
        EmailLink::log($notifiable->email, 'Leads assigned', $url);

        $mail = (new MailMessage)
            ->subject($one ? "{$one->name} was assigned to you" : "{$count} leads assigned to you")
            ->greeting("Hi {$notifiable->name},")
            ->line($one ? "{$this->assignedBy} assigned you a lead:" : "{$this->assignedBy} assigned you {$count} leads:");

        foreach ($this->leads->take(self::LISTED) as $lead) {
            $mail->line("• **{$lead->name}**, {$lead->company} (score {$lead->score})");
        }
        if ($count > self::LISTED) {
            $mail->line('…and '.($count - self::LISTED).' more.');
        }

        return $mail
            ->action($one ? 'Open the lead' : 'Open your leads', $url)
            ->line('You get this because a teammate chose to email you when assigning leads.');
    }
}
