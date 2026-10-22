<?php

namespace App\Console\Commands;

use App\Enums\Reminder;
use App\Enums\UserStatus;
use App\Models\Task;
use App\Models\User;
use App\Notifications\OverdueTasksSummary;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Emails each person one summary of their overdue tasks: open, past their due time, and with
 * email reminders turned on. At most once a day per person (the day in LOCAL_TIMEZONE), so
 * running it again the same day sends nothing new.
 *
 * The scheduler (routes/console.php) runs it every minute with --scheduled: then it sends the
 * day's summaries at 9:00, or, if the app wasn't running at 9:00, the first time it runs after
 * that, and does nothing else for the rest of the day.
 *
 * By hand, for a test or a demo, it sends right away:  php artisan nexora:send-overdue-summaries
 */
class SendOverdueSummaries extends Command
{
    protected $signature = 'nexora:send-overdue-summaries {--scheduled : Run by the scheduler: only at or after 9:00, once a day}';

    protected $description = 'Email each person a summary of their overdue tasks (once a day)';

    /** When the day's summaries go out, in LOCAL_TIMEZONE. */
    public const SEND_AT = '09:00';

    /** Cache key holding the last day (Y-m-d) the scheduled run sent the summaries. */
    public const LAST_RUN_KEY = 'nexora:overdue-summaries:last-scheduled-day';

    public function handle(): int
    {
        $now = now(config('app.local_timezone'));
        $today = $now->toDateString();

        if ($this->option('scheduled')) {
            // Before 9:00, or already done today: nothing to do.
            if ($now->format('H:i') < self::SEND_AT || Cache::get(self::LAST_RUN_KEY) === $today) {
                return self::SUCCESS;
            }
        }

        $sent = 0;
        $already = 0;
        $failed = 0;

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

            try {
                $user->notify(new OverdueTasksSummary($tasks));
            } catch (Throwable $e) {
                // One failed email (say, the mail server refused it) mustn't stop everyone else's.
                report($e);
                $failed++;

                continue;
            }
            $user->forceFill(['overdue_summary_sent_on' => $today])->saveQuietly();
            $sent++;
        }

        // The day's scheduled run is done: later runs today do nothing, even for tasks that only
        // become overdue this afternoon (they're in tomorrow's summary).
        if ($this->option('scheduled')) {
            Cache::forever(self::LAST_RUN_KEY, $today);
        }

        $this->info("Sent {$sent} overdue ".($sent === 1 ? 'summary' : 'summaries').'.'.($already ? " {$already} already sent today." : '').($failed ? " {$failed} failed (see storage/logs/laravel.log)." : ''));

        return self::SUCCESS;
    }
}
