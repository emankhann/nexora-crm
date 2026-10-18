<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Activity */
class ActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'title' => $this->title,
            'body' => $this->body ?? '',
            'by' => $this->user?->shortName() ?? 'System',
            'byId' => $this->user_id,
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'dealId' => $this->deal_id,
            'taskId' => $this->task_id,
            'assigneeId' => $this->assignee_id,
            'assigneeName' => $this->assignee?->shortName(),
            'at' => $this->occurred_at?->toIso8601String(),
        ];
    }
}
