<?php

namespace App\Enums;

enum CustomerHealth: string
{
    case Healthy = 'healthy';
    case Watch = 'watch';
    case AtRisk = 'at_risk';

    public function label(): string
    {
        return match ($this) {
            self::Healthy => 'Healthy',
            self::Watch => 'Watch',
            self::AtRisk => 'At risk',
        };
    }
}
