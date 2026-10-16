<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Shared by records that have an owner (leads, customers, deals).
 * visibleTo() is the data-access rule: sales reps only see what they own.
 */
trait HasOwner
{
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->canViewAll()
            ? $query
            : $query->where($this->qualifyColumn('owner_id'), $user->id);
    }
}
