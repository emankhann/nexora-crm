<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Task reminder emails. Run the scheduler with:  php artisan schedule:work
Schedule::command('nexora:send-task-reminders')->everyMinute()->withoutOverlapping();
