<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Lead;
use App\Models\User;

/**
 * Admins and managers can work on every lead. Sales reps only on leads they own.
 * Only admins can delete.
 */
class LeadPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Lead $lead): bool
    {
        return $user->role->canViewAll() || (int) $lead->owner_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Lead $lead): bool
    {
        return $user->role->canViewAll() || (int) $lead->owner_id === (int) $user->id;
    }

    public function delete(User $user, Lead $lead): bool
    {
        return $user->role === Role::Admin;
    }
}
