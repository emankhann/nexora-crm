<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Customer;
use App\Models\User;

/**
 * Same rules as leads: reps work on what they own, admins and managers on everything,
 * only admins delete.
 */
class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Customer $record): bool
    {
        return $user->role->canViewAll() || (int) $record->owner_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Customer $record): bool
    {
        return $user->role->canViewAll() || (int) $record->owner_id === (int) $user->id;
    }

    public function delete(User $user, Customer $record): bool
    {
        return $user->role === Role::Admin;
    }
}
