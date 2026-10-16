<?php

namespace App\Enums;

enum Reminder: string
{
    case None = 'none';
    case FifteenMinutes = '15m';
    case OneHour = '1h';
    case OneDay = '1d';

    /** Minutes before the due time that the reminder fires. */
    public function minutesBefore(): ?int
    {
        return match ($this) {
            self::None => null,
            self::FifteenMinutes => 15,
            self::OneHour => 60,
            self::OneDay => 1440,
        };
    }
}
