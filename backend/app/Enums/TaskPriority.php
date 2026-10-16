<?php

namespace App\Enums;

enum TaskPriority: string
{
    case Urgent = 'urgent';
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';
}
