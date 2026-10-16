<?php

namespace App\Enums;

enum LeadSource: string
{
    case Referral = 'referral';
    case Website = 'website';
    case LinkedIn = 'linkedin';
    case Event = 'event';
    case ColdEmail = 'cold_email';

    public function label(): string
    {
        return match ($this) {
            self::Referral => 'Referral',
            self::Website => 'Website',
            self::LinkedIn => 'LinkedIn',
            self::Event => 'Event',
            self::ColdEmail => 'Cold email',
        };
    }
}
