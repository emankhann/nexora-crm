<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TaskFollowUp */
class FollowUpResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'at' => $this->created_at?->toIso8601String(),
            'by' => $this->user?->shortName(),
            'outcome' => $this->outcome,
            'note' => $this->note ?? '',
            'rescheduledTo' => $this->rescheduled_to?->toIso8601String(),
        ];
    }
}
