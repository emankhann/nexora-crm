<?php

namespace App\Console\Commands;

use App\Enums\Reminder;
use App\Enums\UserStatus;
use App\Models\Task;
use App\Notifications\TaskReminder;
use Illuminate\Console\Command;

/**
 * Emails "your task is due soon" reminders for tasks with Email reminders turned on.
 * A reminder goes out when its time comes (15 minutes, 1 hour or 1 day before the task is due),
 * once per task. Moving the due time sends it again (see Task::booted).
 *
 * Runs every minute from the scheduler (routes/console.php):  php artisan schedule:work
 * Or by hand:                                                  php artisan nexora:send-task-reminders
 */
class SendTaskReminders extends Command
{
    protected $signature = 'nexora:send-task-reminders';

    protected $description = 'Email reminders for tasks whose reminder time has come';

    public function handle(): int
    {
        $now = now();

        $due = Task::query()
            ->whereNull('completed_at')
            ->where('remind_by_email', true)
            ->where('reminder', '!=', Reminder::None->value)
            ->whereNull('reminder_sent_at')
            // Only upcoming or just-missed tasks: nobody wants a reminder for last week.
            ->whereBetween('due_at', [$now->copy()->subHours(2), $now->copy()->addDay()->addMinute()])
            ->with(['assignee', 'lead', 'customer'])
            ->get()
            ->filter(fn (Task $task) => $task->due_at->copy()->subMinutes($task->reminder->minutesBefore() ?? 0)->lte($now));

        $sent = 0;
        foreach ($due as $task) {
            if ($task->assignee && $task->assignee->status === UserStatus::Active) {
                $task->assignee->notify(new TaskReminder($task));
                $sent++;
            }
            $task->forceFill(['reminder_sent_at' => $now])->saveQuietly();
        }

        $this->info("Sent {$sent} task ".($sent === 1 ? 'reminder' : 'reminders').'.');

        return self::SUCCESS;
    }
}
