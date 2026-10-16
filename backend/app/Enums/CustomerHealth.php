<?php

namespace App\Enums;

enum CustomerHealth: string
{
    case Healthy = 'healthy';
    case Watch = 'watch';
    case AtRisk = 'at_risk';
}
