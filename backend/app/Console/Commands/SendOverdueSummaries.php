<?php

namespace App\Console\Commands;

use App\Enums\Reminder;
use App\Enums\UserStatus;
use App\Models\Task;
use App\Models\User;
use App\Notifications\OverdueTasksSummary;
use Illuminate\Console\Command;

/**
 * Emails each person one summary of their overdue tasks: open, past their due time, and with
 * email reminders turned on. At most once a day per person (the day in LOCAL_TIMEZONE), so
 * running it again the same day sends nothing new.
 *
 * Runs at 9:00 every morning from the scheduler (routes/console.php):  php artisan schedule:work
 * Or by hand, for a test or a demo:                                    php artisan nexora:send-overdue-summaries
 */
class SendOverdueSummaries extends Command
{
    protected $signature = 'nexora:send-overdue-summaries';

    protected $description = 'Email each person a summary of their overdue tasks (once a day)';

    public function handle(): int
    {
        $today = now(config('app.local_timezone'))->toDateString();
        $sent = 0;
        $already = 0;

        $users = User::where('status', UserStatus::Active->value)->get();
        foreach ($users as $user) {
            $tasks = Task::query()
                ->where('assigned_to', $user->id)
                ->whereNull('completed_at')
                ->where('remind_by_email', true)
                ->where('reminder', '!=', Reminder::None->value)
                ->where('due_at', '<', now())
                ->with(['lead', 'customer'])
                ->orderBy('due_at')
                ->get();
            if ($tasks->isEmpty()) {
                continue;
            }
            if ($user->overdue_summary_sent_on?->toDateString() === $today) {
                $already++;

                continue;
            }

            $user->notify(new OverdueTasksSummary($tasks));
            $user->forceFill(['overdue_summary_sent_on' => $today])->saveQuietly();
            $sent++;
        }

        $this->info("Sent {$sent} overdue ".($sent === 1 ? 'summary' : 'summaries').'.'.($already ? " {$already} already sent today." : ''));

        return self::SUCCESS;
    }
}
