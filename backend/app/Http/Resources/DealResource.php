<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Deal */
class DealResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'company' => $this->company,
            'value' => (float) $this->value,
            'stage' => $this->stage->value,
            'probability' => $this->probability,
            'temperature' => $this->temperature->value,
            'closeDate' => $this->expected_close_date?->toDateString(),
            'nextStep' => $this->next_step ?? '',
            'ownerId' => $this->owner_id,
            'ownerName' => $this->owner?->shortName(),
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'lostReason' => $this->lost_reason ?? '',
            'closedAt' => $this->closed_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
