<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Task */
class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $contact = $this->lead?->name ?? $this->customer?->primaryContact?->name ?? '';
        $company = $this->lead?->company ?? $this->customer?->name ?? '';

        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type->value,
            'priority' => $this->priority->value,
            'dueAt' => $this->due_at?->toIso8601String(),
            'reminder' => $this->reminder->value,
            'remindByEmail' => $this->remind_by_email,
            'assignedTo' => $this->assigned_to,
            'ownerName' => $this->assignee?->shortName(),
            'createdBy' => $this->creator?->shortName(),
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'dealId' => $this->deal_id,
            'contact' => $contact,
            'company' => $company,
            'notes' => $this->notes ?? '',
            'done' => $this->completed_at !== null,
            'doneAt' => $this->completed_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'followUps' => FollowUpResource::collection($this->whenLoaded('followUps')),
        ];
    }
}
