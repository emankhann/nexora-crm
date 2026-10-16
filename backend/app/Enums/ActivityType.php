<?php

namespace App\Enums;

/**
 * Everything that appears in a communication history / timeline.
 * call, email, meeting and note are logged by people; the rest are recorded automatically.
 */
enum ActivityType: string
{
    case Call = 'call';
    case Email = 'email';
    case Meeting = 'meeting';
    case Note = 'note';
    case Proposal = 'proposal';
    case StatusChange = 'status';
    case Created = 'created';
    case Assigned = 'assigned';
    case Converted = 'converted';
    case Deal = 'deal';
}
