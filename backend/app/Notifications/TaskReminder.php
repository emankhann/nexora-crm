<?php

namespace App\Notifications;

use App\Models\Task;
use App\Support\EmailLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** "Your task is due soon" email, sent by the nexora:send-task-reminders command. */
class TaskReminder extends Notification
{
    use Queueable;

    public function __construct(public Task $task) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $task = $this->task;
        $due = $task->due_at->copy()->timezone(config('app.local_timezone'))->format('D j M, g:i A');
        $about = $task->lead?->name ?? $task->customer?->name;
        $url = config('app.frontend_url').'/tasks?open='.$task->id;
        EmailLink::log($notifiable->email, 'Task reminder', $url);

        return (new MailMessage)
            ->subject("Reminder: {$task->title}")
            ->greeting("Hi {$notifiable->name},")
            ->line("“{$task->title}” is due {$due}.")
            ->lineIf((bool) $about, "It’s about {$about}.")
            ->lineIf((bool) $task->notes, "Notes: {$task->notes}")
            ->action('Open the task', $url)
            ->line('You get this because email reminders are on for this task.');
    }
}
