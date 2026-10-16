<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AuditLog */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'at' => $this->created_at?->toIso8601String(),
            'user' => $this->user?->shortName() ?? 'System',
            'action' => $this->action,
            'record' => $this->record_label,
            'details' => $this->details ?? '',
        ];
    }
}
