<?php

namespace App\Notifications;

use App\Models\Task;
use App\Support\EmailLink;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

/**
 * The daily "you have overdue tasks" email, sent by nexora:send-overdue-summaries: one email
 * per person, listing their open tasks that are past due and have email reminders on.
 */
class OverdueTasksSummary extends Notification
{
    use Queueable;

    /** Tasks listed by name in the email; the rest are counted. */
    private const LISTED = 20;

    /** @param  Collection<int, Task>  $tasks */
    public function __construct(public Collection $tasks) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = $this->tasks->count();
        $url = config('app.frontend_url').'/tasks';
        EmailLink::log($notifiable->email, 'Overdue tasks', $url);

        $mail = (new MailMessage)
            ->subject($count === 1 ? "Overdue task: {$this->tasks->first()->title}" : "You have {$count} overdue tasks")
            ->greeting("Hi {$notifiable->name},")
            ->line($count === 1 ? 'This task is past its due time:' : 'These tasks are past their due time:');

        foreach ($this->tasks->take(self::LISTED) as $task) {
            $due = $task->due_at->copy()->timezone(config('app.local_timezone'))->format('D j M, g:i A');
            $late = $task->due_at->diffForHumans(now(), CarbonInterface::DIFF_ABSOLUTE);
            $about = $task->lead?->name ?? $task->customer?->name;
            $mail->line("• **{$task->title}**, due {$due} ({$late} late)".($about ? ", about {$about}" : '').'.');
        }
        if ($count > self::LISTED) {
            $mail->line('…and '.($count - self::LISTED).' more.');
        }

        return $mail
            ->action('Open your tasks', $url)
            ->line('You get this once a day while you have overdue tasks with email reminders on. Complete or reschedule them to stop it.');
    }
}
