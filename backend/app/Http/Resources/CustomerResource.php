<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Customer */
class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [$this->name];
        $initials = count($parts) > 1 ? mb_substr($parts[0], 0, 1).mb_substr(end($parts), 0, 1) : mb_substr($parts[0], 0, 2);

        return [
            'id' => $this->id,
            'initials' => mb_strtoupper($initials),
            'name' => $this->name,
            'industry' => $this->industry,
            'size' => $this->size ?? '',
            'website' => $this->website ?? '',
            'city' => $this->city ?? '',
            'health' => $this->health->value,
            'lifetimeValue' => (float) $this->lifetime_value,
            'legacyOpenDeals' => $this->legacy_open_deals,
            'ownerId' => $this->owner_id,
            'ownerName' => $this->owner?->shortName(),
            'leadId' => $this->lead_id,
            'since' => $this->customer_since?->toDateString(),
            'contacts' => ContactResource::collection($this->whenLoaded('contacts')),
        ];
    }
}
