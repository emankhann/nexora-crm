<?php

namespace App\Services;

use App\Enums\ActivityType;
use App\Models\Activity;
use App\Models\Lead;
use Illuminate\Support\Facades\Auth;

/**
 * Writes an entry to the communication history and bumps the lead's "last activity" time.
 */
class ActivityRecorder
{
    /**
     * @param  array{lead_id?: int|null, customer_id?: int|null, deal_id?: int|null, task_id?: int|null, assignee_id?: int|null}  $refs
     */
    public function record(ActivityType $type, string $title, ?string $body = null, array $refs = [], $occurredAt = null): Activity
    {
        $activity = Activity::create(array_merge([
            'type' => $type,
            'title' => mb_substr($title, 0, 255),
            'body' => $body,
            'user_id' => Auth::id(),
            'occurred_at' => $occurredAt ?? now(),
        ], array_filter($refs, fn ($v) => $v !== null)));

        if (! empty($refs['lead_id'])) {
            Lead::whereKey($refs['lead_id'])->update(['last_activity_at' => now()]);
        }

        return $activity;
    }
}
