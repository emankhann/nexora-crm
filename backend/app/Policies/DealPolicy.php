<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Deal;
use App\Models\User;

/**
 * Same rules as leads: reps work on what they own, admins and managers on everything,
 * only admins delete.
 */
class DealPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Deal $record): bool
    {
        return $user->role->canViewAll() || (int) $record->owner_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Deal $record): bool
    {
        return $user->role->canViewAll() || (int) $record->owner_id === (int) $user->id;
    }

    public function delete(User $user, Deal $record): bool
    {
        return $user->role === Role::Admin;
    }
}
