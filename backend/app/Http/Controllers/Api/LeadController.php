<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityType;
use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\LeadRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\LeadResource;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\LeadConversionService;
use App\Services\LeadScorer;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class LeadController extends Controller
{
    public function __construct(
        private LeadScorer $scorer,
        private ActivityRecorder $activities,
    ) {}

    /** GET /api/leads?q=&status=&source=&owner_id=&tier=hot|warm|cold&page= */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $leads = Lead::visibleTo($user)
            ->with('owner')
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = '%'.$request->string('q')->trim().'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('company', 'like', $term)
                    ->orWhere('email', 'like', $term));
            })
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->when($request->filled('source'), fn ($q) => $q->where('source', $request->input('source')))
            ->when($request->filled('owner_id'), fn ($q) => $q->where('owner_id', $request->integer('owner_id')))
            ->when($request->input('tier') === 'hot', fn ($q) => $q->where('score', '>=', 80))
            ->when($request->input('tier') === 'warm', fn ($q) => $q->whereBetween('score', [50, 79]))
            ->when($request->input('tier') === 'cold', fn ($q) => $q->where('score', '<', 50))
            ->latest('last_activity_at')
            ->paginate(min(100, $request->integer('per_page', 25)));

        return LeadResource::collection($leads);
    }

    public function show(Request $request, Lead $lead): LeadResource
    {
        Gate::authorize('view', $lead);

        return new LeadResource($lead->load('owner'));
    }

    public function store(LeadRequest $request): JsonResponse
    {
        Gate::authorize('create', Lead::class);
        $user = $request->user();
        $data = $request->validated();

        // Sales reps can only create leads for themselves.
        $data['owner_id'] = Gate::allows('reassign') ? ($data['owner_id'] ?? null) : $user->id;
        $status = LeadStatus::from($data['status']);
        $scored = $this->scorer->score(LeadSource::from($data['source']), $status, $data['job_title'] ?? null, $data['company_size'] ?? null, $data['phone'] ?? null, $data['email']);

        $lead = DB::transaction(function () use ($data, $scored, $status, $user) {
            $lead = Lead::create([
                ...$data,
                'score' => $scored['score'],
                'score_factors' => $scored['factors'],
                'auto_score' => true,
                'contacted_at' => in_array($status, [LeadStatus::Contacted, LeadStatus::Qualified], true) ? now() : null,
                'qualified_at' => $status === LeadStatus::Qualified ? now() : null,
                'last_activity_at' => now(),
            ]);

            $this->activities->record(ActivityType::Created, 'Lead created', "Source: {$lead->source->label()}".($lead->notes ? " · {$lead->notes}" : ''), ['lead_id' => $lead->id]);
            if ($lead->owner_id && (int) $lead->owner_id !== (int) $user->id) {
                $this->recordAssignment($lead, $lead->owner_id);
            }
            Audit::log('Created', $lead, $lead->name, "Lead added from {$lead->source->label()}");

            return $lead;
        });

        return (new LeadResource($lead->load('owner')))->response()->setStatusCode(201);
    }

    public function update(LeadRequest $request, Lead $lead): LeadResource
    {
        Gate::authorize('update', $lead);
        $data = $request->validated();

        // Changing the owner needs the reassign permission (admins and managers).
        if (array_key_exists('owner_id', $data) && (int) $data['owner_id'] !== (int) $lead->owner_id) {
            Gate::authorize('reassign');
        } else {
            unset($data['owner_id']);
        }

        DB::transaction(function () use ($lead, $data) {
            $before = $lead->replicate();
            $lead->fill($data);
            $this->stampStageDates($lead);

            if ($lead->auto_score) {
                $scored = $this->scorer->score($lead->source, $lead->status, $lead->job_title, $lead->company_size, $lead->phone, $lead->email);
                $lead->score = $scored['score'];
                $lead->score_factors = $scored['factors'];
            }
            $lead->last_activity_at = now();
            $lead->save();

            if ($before->status !== $lead->status) {
                $this->activities->record(ActivityType::StatusChange, "Status changed from {$before->status->label()} to {$lead->status->label()}", null, ['lead_id' => $lead->id]);
            }
            if ((int) $before->owner_id !== (int) $lead->owner_id) {
                $this->recordAssignment($lead, $lead->owner_id);
            }
            Audit::log('Updated', $lead, $lead->name, 'Lead details edited');
        });

        return new LeadResource($lead->load('owner'));
    }

    public function destroy(Lead $lead): Response
    {
        Gate::authorize('delete', $lead);

        DB::transaction(function () use ($lead) {
            Task::where('lead_id', $lead->id)->whereNull('completed_at')->delete();
            $lead->delete();
            Audit::log('Deleted', $lead, $lead->name, 'Lead deleted with its open tasks');
        });

        return response()->noContent();
    }

    /**
     * POST /api/leads/bulk  { action: assign|status|delete, ids: [..], owner_id?, status? }
     * Each lead is checked against the policy, so a bulk request can't touch
     * records the user isn't allowed to change.
     */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['assign', 'status', 'delete'])],
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer'],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'status' => ['required_if:action,status', Rule::enum(LeadStatus::class)->except([LeadStatus::Converted])],
        ]);
        $leads = Lead::whereIn('id', $data['ids'])->get();

        DB::transaction(function () use ($data, $leads) {
            foreach ($leads as $lead) {
                switch ($data['action']) {
                    case 'assign':
                        Gate::authorize('reassign');
                        $newOwner = $data['owner_id'] ?? null;
                        if ((int) $lead->owner_id === (int) $newOwner) {
                            break;
                        }
                        $oldName = $lead->owner?->shortName() ?? 'Unassigned';
                        $lead->update(['owner_id' => $newOwner]);
                        $this->recordAssignment($lead, $newOwner);
                        Audit::log('Reassigned', $lead, $lead->name, "Owner changed from {$oldName} to ".(User::find($newOwner)?->shortName() ?? 'Unassigned'));
                        break;

                    case 'status':
                        Gate::authorize('update', $lead);
                        $from = $lead->status;
                        $lead->status = LeadStatus::from($data['status']);
                        if ($from === $lead->status) {
                            break;
                        }
                        $this->stampStageDates($lead);
                        if ($lead->auto_score) {
                            $scored = $this->scorer->score($lead->source, $lead->status, $lead->job_title, $lead->company_size, $lead->phone, $lead->email);
                            $lead->score = $scored['score'];
                            $lead->score_factors = $scored['factors'];
                        }
                        $lead->last_activity_at = now();
                        $lead->save();
                        $this->activities->record(ActivityType::StatusChange, "Status changed from {$from->label()} to {$lead->status->label()}", null, ['lead_id' => $lead->id]);
                        Audit::log('Status changed', $lead, $lead->name, "{$from->label()} to {$lead->status->label()}");
                        break;

                    case 'delete':
                        Gate::authorize('delete', $lead);
                        Task::where('lead_id', $lead->id)->whereNull('completed_at')->delete();
                        $lead->delete();
                        Audit::log('Deleted', $lead, $lead->name, 'Lead deleted with its open tasks');
                        break;
                }
            }
        });

        return response()->json(['updated' => $leads->count()]);
    }

    /** POST /api/leads/{lead}/convert — see LeadConversionService. */
    public function convert(Request $request, Lead $lead, LeadConversionService $conversion): CustomerResource
    {
        Gate::authorize('update', $lead);
        abort_if($lead->status === LeadStatus::Converted, 422, 'This lead is already a customer.');

        $data = $request->validate([
            'mode' => ['required', Rule::in(['new', 'existing'])],
            'customer_id' => ['required_if:mode,existing', 'nullable', 'integer', Rule::exists('customers', 'id')->withoutTrashed()],
            'industry' => ['required_if:mode,new', 'nullable', 'string', 'max:100'],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'create_deal' => ['boolean'],
            'deal.title' => ['required_if:create_deal,true', 'nullable', 'string', 'max:150'],
            'deal.value' => ['required_if:create_deal,true', 'nullable', 'numeric', 'gt:0'],
            'deal.stage' => ['required_if:create_deal,true', 'nullable', Rule::in(['new', 'contacted', 'qualified', 'proposal', 'won'])],
            'deal.close_date' => ['required_if:create_deal,true', 'nullable', 'date'],
        ]);

        if ($data['mode'] === 'new') {
            abort_if(Customer::where('name', $lead->company)->exists(), 422, "A customer called {$lead->company} already exists. Choose “Add to existing”.");
        }

        $user = $request->user();
        $data['owner_id'] = Gate::allows('reassign') ? ($data['owner_id'] ?? $lead->owner_id ?? $user->id) : $user->id;
        $data['create_deal'] = (bool) ($data['create_deal'] ?? false);

        $customer = $conversion->convert($lead, $data, $user);

        return new CustomerResource($customer->load(['owner', 'contacts']));
    }

    /**
     * POST /api/leads/import (multipart, field "file")
     * CSV with a header row; needs at least Name and Email columns.
     * Rows with an invalid or duplicate email are skipped and counted.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);
        $user = $request->user();

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = array_map(fn ($h) => strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), fgetcsv($handle) ?: []);
        $col = fn (string ...$names) => collect($names)->map(fn ($n) => array_search($n, $header, true))->first(fn ($i) => $i !== false);
        $map = [
            'name' => $col('name', 'full name'),
            'email' => $col('email'),
            'company' => $col('company'),
            'phone' => $col('phone'),
            'job_title' => $col('job title', 'title'),
            'source' => $col('source'),
        ];
        abort_if($map['name'] === null || $map['email'] === null, 422, 'The CSV needs at least Name and Email columns.');

        $added = 0;
        $skipped = 0;
        DB::transaction(function () use ($handle, $map, $user, &$added, &$skipped) {
            while (($row = fgetcsv($handle)) !== false) {
                $email = strtolower(trim($row[$map['email']] ?? ''));
                $name = trim($row[$map['name']] ?? '');
                if ($name === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL) || Lead::withTrashed()->where('email', $email)->exists()) {
                    $skipped++;

                    continue;
                }
                $sourceText = strtolower(str_replace(' ', '_', trim($row[$map['source'] ?? -1] ?? '')));
                $source = LeadSource::tryFrom($sourceText) ?? LeadSource::Website;
                $phone = $map['phone'] !== null ? trim($row[$map['phone']] ?? '') : null;
                $title = $map['job_title'] !== null ? trim($row[$map['job_title']] ?? '') : null;
                $scored = $this->scorer->score($source, LeadStatus::New, $title, null, $phone, $email);

                $lead = Lead::create([
                    'name' => mb_substr($name, 0, 120),
                    'email' => $email,
                    'company' => mb_substr(trim($row[$map['company'] ?? -1] ?? '') ?: 'Unknown', 0, 150),
                    'phone' => $phone ?: null,
                    'job_title' => $title ?: null,
                    'source' => $source,
                    'status' => LeadStatus::New,
                    'score' => $scored['score'],
                    'score_factors' => $scored['factors'],
                    'auto_score' => true,
                    'owner_id' => $user->id,
                    'notes' => 'Imported from CSV',
                    'last_activity_at' => now(),
                ]);
                $this->activities->record(ActivityType::Created, 'Lead created', 'Imported from CSV', ['lead_id' => $lead->id]);
                $added++;
            }
        });
        fclose($handle);

        if ($added > 0) {
            Audit::log('Created', null, "{$added} leads", 'Imported from CSV');
        }

        return response()->json(['added' => $added, 'skipped' => $skipped]);
    }

    /** Fill in when the lead first reached each stage. */
    private function stampStageDates(Lead $lead): void
    {
        if (in_array($lead->status, [LeadStatus::Contacted, LeadStatus::Qualified], true) && ! $lead->contacted_at) {
            $lead->contacted_at = now();
        }
        if ($lead->status === LeadStatus::Qualified && ! $lead->qualified_at) {
            $lead->qualified_at = now();
        }
    }

    private function recordAssignment(Lead $lead, ?int $ownerId): void
    {
        $name = User::find($ownerId)?->shortName() ?? 'Unassigned';
        $actor = request()->user()?->shortName() ?? 'System';
        $this->activities->record(ActivityType::Assigned, "{$lead->name} assigned to {$name}", "By {$actor}", ['lead_id' => $lead->id, 'assignee_id' => $ownerId]);
    }
}
