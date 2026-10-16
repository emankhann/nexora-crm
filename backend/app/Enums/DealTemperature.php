<?php

namespace App\Enums;

enum DealTemperature: string
{
    case Hot = 'hot';
    case Warm = 'warm';
    case New = 'new';
    case Cold = 'cold';
}
