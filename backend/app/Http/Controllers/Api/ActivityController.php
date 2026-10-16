<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityResource;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Services\ActivityRecorder;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * POST /api/activities: log a call, email, meeting or note against a lead, customer or deal.
 */
class ActivityController extends Controller
{
    public function store(Request $request, ActivityRecorder $recorder): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['call', 'email', 'meeting', 'note'])],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now'],
            'lead_id' => ['nullable', 'integer', 'required_without_all:customer_id,deal_id'],
            'customer_id' => ['nullable', 'integer'],
            'deal_id' => ['nullable', 'integer'],
        ]);

        // You can only add history to records you can see.
        $lead = isset($data['lead_id']) ? Lead::findOrFail($data['lead_id']) : null;
        $customer = isset($data['customer_id']) ? Customer::findOrFail($data['customer_id']) : null;
        $deal = isset($data['deal_id']) ? Deal::findOrFail($data['deal_id']) : null;
        foreach (array_filter([$lead, $customer, $deal]) as $record) {
            Gate::authorize('view', $record);
        }

        $type = ActivityType::from($data['type']);
        $activity = $recorder->record($type, $data['title'], $data['body'] ?? null, [
            'lead_id' => $lead?->id,
            'customer_id' => $customer?->id ?? $lead?->customer_id,
            'deal_id' => $deal?->id,
        ], $data['occurred_at'] ?? null);

        $action = match ($type) {
            ActivityType::Note => 'Note added',
            ActivityType::Call => 'Call logged',
            default => 'Updated',
        };
        Audit::log($action, $lead ?? $customer ?? $deal, ($lead ?? $customer)?->name ?? $deal?->title ?? 'Record', $data['title']);

        return (new ActivityResource($activity->load(['user', 'assignee'])))->response()->setStatusCode(201);
    }
}
