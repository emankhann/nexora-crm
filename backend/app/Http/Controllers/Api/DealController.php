<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityType;
use App\Enums\DealStage;
use App\Enums\DealTemperature;
use App\Http\Controllers\Controller;
use App\Http\Requests\DealRequest;
use App\Http\Resources\DealResource;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Services\ActivityRecorder;
use App\Services\DealStageService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DealController extends Controller
{
    public function __construct(
        private DealStageService $stages,
        private ActivityRecorder $activities,
    ) {}

    /** GET /api/deals?stage=&owner_id=&closing=month|overdue */
    public function index(Request $request): AnonymousResourceCollection
    {
        $deals = Deal::visibleTo($request->user())
            ->with('owner')
            ->when($request->filled('stage'), fn ($q) => $q->where('stage', $request->input('stage')))
            ->when($request->filled('owner_id'), fn ($q) => $q->where('owner_id', $request->integer('owner_id')))
            ->when($request->input('closing') === 'month', fn ($q) => $q->whereBetween('expected_close_date', [now()->startOfMonth(), now()->endOfMonth()]))
            ->when($request->input('closing') === 'overdue', fn ($q) => $q->open()->where('expected_close_date', '<', now()->toDateString()))
            ->orderBy('expected_close_date')
            ->paginate(min(100, $request->integer('per_page', 50)));

        return DealResource::collection($deals);
    }

    public function show(Deal $deal): DealResource
    {
        Gate::authorize('view', $deal);

        return new DealResource($deal->load('owner'));
    }

    public function store(DealRequest $request): JsonResponse
    {
        Gate::authorize('create', Deal::class);
        $data = $request->validated();
        $this->authorizeLinks($data);
        $user = $request->user();
        $stage = DealStage::from($data['stage']);

        $deal = DB::transaction(function () use ($data, $user, $stage) {
            $deal = Deal::create([
                ...$data,
                'probability' => $data['probability'] ?? $stage->probability(),
                'temperature' => $data['temperature'] ?? DealTemperature::Warm->value,
                'owner_id' => Gate::allows('reassign') ? ($data['owner_id'] ?? $user->id) : $user->id,
                'closed_at' => $stage->isOpen() ? null : now(),
            ]);
            if ($stage === DealStage::Won && $deal->customer) {
                $deal->customer->increment('lifetime_value', $deal->value);
            }
            $this->activities->record(
                ActivityType::Deal,
                "Deal created: {$deal->title}",
                "{$stage->label()} · $".number_format((float) $deal->value),
                ['deal_id' => $deal->id, 'lead_id' => $deal->lead_id, 'customer_id' => $deal->customer_id],
            );
            Audit::log('Created', $deal, $deal->title, "Deal for {$deal->company}");

            return $deal;
        });

        return (new DealResource($deal->load('owner')))->response()->setStatusCode(201);
    }

    public function update(DealRequest $request, Deal $deal): DealResource
    {
        Gate::authorize('update', $deal);
        $data = $request->validated();
        $this->authorizeLinks($data);

        if (array_key_exists('owner_id', $data) && (int) $data['owner_id'] !== (int) $deal->owner_id) {
            Gate::authorize('reassign');
        }

        DB::transaction(function () use ($deal, $data) {
            $newStage = DealStage::from($data['stage']);
            $changes = [];
            if ($deal->expected_close_date?->toDateString() !== date('Y-m-d', strtotime($data['expected_close_date']))) {
                $changes[] = 'close date changed';
            }
            if ((float) $deal->value !== (float) $data['value']) {
                $changes[] = 'value changed';
            }

            // Save everything except the stage; the stage goes through DealStageService.
            $deal->update(collect($data)
                ->except(['stage', 'lost_reason'])
                ->reject(fn ($value, $key) => $value === null && in_array($key, ['probability', 'temperature'], true))
                ->all());
            Audit::log('Updated', $deal, $deal->title, $changes ? implode(', ', $changes) : 'Deal details edited');

            if ($newStage !== $deal->stage) {
                $this->stages->move($deal, $newStage, $data['lost_reason'] ?? null);
            }
        });

        return new DealResource($deal->refresh()->load('owner'));
    }

    /** POST /api/deals/{deal}/move  { stage, lost_reason? } (used by drag and drop) */
    public function move(Request $request, Deal $deal): DealResource
    {
        Gate::authorize('update', $deal);
        $data = $request->validate([
            'stage' => ['required', Rule::enum(DealStage::class)],
            'lost_reason' => ['required_if:stage,lost', 'nullable', 'string', 'max:255'],
        ]);

        $this->stages->move($deal, DealStage::from($data['stage']), $data['lost_reason'] ?? null);

        return new DealResource($deal->refresh()->load('owner'));
    }

    /**
     * A deal can only be linked to a lead or customer the user can see. Without this, a sales
     * rep could attach a deal to another rep's customer (and add to its lifetime value when won).
     */
    private function authorizeLinks(array $data): void
    {
        if (! empty($data['lead_id'])) {
            Gate::authorize('view', Lead::findOrFail($data['lead_id']));
        }
        if (! empty($data['customer_id'])) {
            Gate::authorize('view', Customer::findOrFail($data['customer_id']));
        }
    }

    public function destroy(Deal $deal): Response
    {
        Gate::authorize('delete', $deal);

        DB::transaction(function () use ($deal) {
            if ($deal->stage === DealStage::Won && $deal->customer) {
                $deal->customer->decrement('lifetime_value', $deal->value);
            }
            Task::where('deal_id', $deal->id)->update(['deal_id' => null]);
            $deal->delete();
            Audit::log('Deleted', $deal, $deal->title, 'Deal deleted');
        });

        return response()->noContent();
    }
}
