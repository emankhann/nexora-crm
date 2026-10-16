<?php

namespace App\Enums;

/**
 * The three roles from the assignment brief. Stored as a string in users.role.
 */
enum Role: string
{
    case Admin = 'admin';
    case Manager = 'manager';
    case SalesRep = 'sales_rep';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Manager => 'Manager',
            self::SalesRep => 'Sales rep',
        };
    }

    /** Admins and managers see every record; sales reps only their own. */
    public function canViewAll(): bool
    {
        return $this !== self::SalesRep;
    }
}
