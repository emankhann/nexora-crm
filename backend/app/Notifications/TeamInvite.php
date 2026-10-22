<?php

namespace App\Notifications;

use App\Models\User;
use App\Support\EmailLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Email with a link to join the team. The link holds a one-time token that lasts 7 days. */
class TeamInvite extends Notification
{
    use Queueable;

    public function __construct(public string $token, public string $invitedBy) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function url(User $user): string
    {
        return config('app.frontend_url').'/accept-invite?'.http_build_query(['token' => $this->token, 'email' => $user->email]);
    }

    public function toMail(User $notifiable): MailMessage
    {
        $url = $this->url($notifiable);
        EmailLink::log($notifiable->email, 'Invite', $url);

        return (new MailMessage)
            ->subject('You’re invited to Nexora')
            ->greeting("Hi {$notifiable->name},")
            ->line("{$this->invitedBy} invited you to join the sales team on Nexora as {$notifiable->role->label()}.")
            ->action('Accept invite', $url)
            ->line('You’ll choose your password on the next page. The link works for 7 days.')
            ->line('If you weren’t expecting this, you can ignore this email.');
    }
}
