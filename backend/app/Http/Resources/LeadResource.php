<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Lead */
class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'initials' => $this->initials(),
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone ?? '',
            'jobTitle' => $this->job_title ?? '',
            'company' => $this->company,
            'companySize' => $this->company_size ?? '',
            'source' => $this->source->value,
            'status' => $this->status->value,
            'score' => $this->score,
            'factors' => $this->score_factors ?? [],
            'autoScore' => $this->auto_score,
            'ownerId' => $this->owner_id,
            'ownerName' => $this->owner?->shortName(),
            'customerId' => $this->customer_id,
            'notes' => $this->notes ?? '',
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastActivityAt' => ($this->last_activity_at ?? $this->updated_at)?->toIso8601String(),
            // [new, contacted, qualified, customer] — when the lead reached each stage.
            'stageDates' => [
                $this->created_at?->toIso8601String(),
                $this->contacted_at?->toIso8601String(),
                $this->qualified_at?->toIso8601String(),
                $this->converted_at?->toIso8601String(),
            ],
        ];
    }
}
