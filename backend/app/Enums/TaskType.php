<?php

namespace App\Enums;

enum TaskType: string
{
    case Call = 'call';
    case Email = 'email';
    case Meeting = 'meeting';
    case Todo = 'todo';
}
