<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Task reminder emails. Run the scheduler with:  php artisan schedule:work
Schedule::command('nexora:send-task-reminders')->everyMinute()->withoutOverlapping();

// The daily overdue-tasks summary: at 9:00 in the local time zone (LOCAL_TIMEZONE in backend/.env),
// or the first minute after that the app is running, if it wasn't at 9:00. Checked every minute;
// the command itself does nothing before 9:00 or once the day's summaries have gone out.
Schedule::command('nexora:send-overdue-summaries --scheduled')->everyMinute()->withoutOverlapping();
