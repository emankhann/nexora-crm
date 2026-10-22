<?php

namespace App\Notifications;

use App\Models\Task;
use App\Support\EmailLink;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "New task for you" email, sent when someone creates a task for another person, or gives
 * an existing task to someone else, with "Email the assignee" ticked.
 */
class TaskAssigned extends Notification
{
    use Queueable;

    public function __construct(public Task $task, public string $assignedBy) {}

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
        EmailLink::log($notifiable->email, 'Task assigned', $url);

        return (new MailMessage)
            ->subject("New task: {$task->title}")
            ->greeting("Hi {$notifiable->name},")
            ->line("{$this->assignedBy} assigned you a task:")
            ->line("**{$task->title}**, due {$due}. Priority: {$task->priority->label()}.")
            ->lineIf((bool) $about, "It’s about {$about}.")
            ->lineIf((bool) $task->notes, "Notes: {$task->notes}")
            ->action('Open the task', $url)
            ->line("You get this because {$this->assignedBy} chose to email you when assigning it.");
    }
}
