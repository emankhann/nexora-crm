<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'short' => $this->shortName(),
            'initials' => $this->initials(),
            'email' => $this->email,
            'role' => $this->role->value,
            'roleLabel' => $this->role->label(),
            'status' => $this->status->value,
            'jobTitle' => $this->job_title,
            'invitedAt' => $this->invited_at?->toIso8601String(),
            'lastActiveAt' => $this->last_active_at?->toIso8601String(),
        ];
    }
}
