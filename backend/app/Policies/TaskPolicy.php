<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Task;
use App\Models\User;

/**
 * Reps see and work on tasks assigned to them. The person who created a task may delete it,
 * and admins may delete any task.
 */
class TaskPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Task $task): bool
    {
        return $user->role->canViewAll() || (int) $task->assigned_to === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Task $task): bool
    {
        return $user->role->canViewAll() || (int) $task->assigned_to === (int) $user->id;
    }

    public function delete(User $user, Task $task): bool
    {
        return $user->role === Role::Admin || (int) $task->created_by === (int) $user->id;
    }
}
