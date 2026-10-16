<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityType;
use App\Enums\CustomerHealth;
use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\ActivityResource;
use App\Http\Resources\ContactResource;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\DealResource;
use App\Http\Resources\TaskResource;
use App\Models\Activity;
use App\Models\Customer;
use App\Services\ActivityRecorder;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CustomerController extends Controller
{
    /** GET /api/customers?q=&industry=&health=&owner_id= */
    public function index(Request $request): AnonymousResourceCollection
    {
        $customers = Customer::visibleTo($request->user())
            ->with(['owner', 'contacts'])
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = '%'.$request->string('q')->trim().'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhereHas('contacts', fn ($c) => $c->where('name', 'like', $term)));
            })
            ->when($request->filled('industry'), fn ($q) => $q->where('industry', $request->input('industry')))
            ->when($request->filled('health'), fn ($q) => $q->where('health', $request->input('health')))
            ->when($request->filled('owner_id'), fn ($q) => $q->where('owner_id', $request->integer('owner_id')))
            ->orderBy('name')
            ->paginate(min(100, $request->integer('per_page', 25)));

        return CustomerResource::collection($customers);
    }

    /**
     * GET /api/customers/{id}: the profile page, with contacts, deals, open tasks,
     * the lead it came from and the full communication history.
     */
    public function show(Customer $customer): JsonResponse
    {
        Gate::authorize('view', $customer);
        $customer->load(['owner', 'contacts', 'lead', 'deals.owner']);

        // History for the customer, plus everything logged on the lead it came from.
        $activities = Activity::query()
            ->where(fn ($q) => $q->where('customer_id', $customer->id)
                ->when($customer->lead_id, fn ($q) => $q->orWhere('lead_id', $customer->lead_id)))
            ->with(['user', 'assignee'])
            ->latest('occurred_at')
            ->limit(200)
            ->get();
        $tasks = $customer->tasks()->whereNull('completed_at')->with(['assignee', 'creator', 'followUps.user'])->orderBy('due_at')->get();

        return response()->json([
            'customer' => new CustomerResource($customer),
            'deals' => DealResource::collection($customer->deals),
            'tasks' => TaskResource::collection($tasks),
            'activities' => ActivityResource::collection($activities),
        ]);
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        Gate::authorize('create', Customer::class);
        $data = $request->validated();
        $user = $request->user();

        $customer = DB::transaction(function () use ($data, $user) {
            $customer = Customer::create([
                'name' => $data['name'],
                'industry' => $data['industry'],
                'size' => $data['size'] ?? null,
                'website' => $data['website'] ?? null,
                'city' => $data['city'] ?? null,
                'health' => CustomerHealth::Healthy,
                'owner_id' => Gate::allows('reassign') ? ($data['owner_id'] ?? $user->id) : $user->id,
                'customer_since' => $data['customer_since'] ?? now()->toDateString(),
            ]);
            $customer->contacts()->create([
                'name' => $data['contact']['name'],
                'job_title' => $data['contact']['job_title'] ?? null,
                'email' => strtolower($data['contact']['email']),
                'phone' => $data['contact']['phone'] ?? null,
                'is_primary' => true,
            ]);
            app(ActivityRecorder::class)->record(ActivityType::Created, 'Customer added', "By {$user->shortName()}", ['customer_id' => $customer->id]);
            Audit::log('Created', $customer, $customer->name, 'Customer added manually');

            return $customer;
        });

        return (new CustomerResource($customer->load(['owner', 'contacts'])))->response()->setStatusCode(201);
    }

    public function update(CustomerRequest $request, Customer $customer): CustomerResource
    {
        Gate::authorize('update', $customer);
        $data = $request->validated();

        if (array_key_exists('owner_id', $data) && (int) $data['owner_id'] !== (int) $customer->owner_id) {
            Gate::authorize('reassign');
        }

        DB::transaction(function () use ($customer, $data) {
            $customer->update(collect($data)->only(['name', 'industry', 'size', 'website', 'city', 'health', 'owner_id', 'customer_since'])->all());

            $primary = $customer->contacts()->where('is_primary', true)->first();
            $contact = [
                'name' => $data['contact']['name'],
                'job_title' => $data['contact']['job_title'] ?? null,
                'email' => strtolower($data['contact']['email']),
                'phone' => $data['contact']['phone'] ?? null,
            ];
            $primary ? $primary->update($contact) : $customer->contacts()->create([...$contact, 'is_primary' => true]);

            Audit::log('Updated', $customer, $customer->name, 'Customer details edited');
        });

        return new CustomerResource($customer->load(['owner', 'contacts']));
    }

    public function destroy(Customer $customer): Response
    {
        Gate::authorize('delete', $customer);
        $customer->delete();
        Audit::log('Deleted', $customer, $customer->name, 'Customer deleted');

        return response()->noContent();
    }

    /** POST /api/customers/{customer}/contacts */
    public function addContact(Request $request, Customer $customer): JsonResponse
    {
        Gate::authorize('update', $customer);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[+()\d\s-]{7,20}$/'],
        ]);

        $contact = $customer->contacts()->create([...$data, 'is_primary' => false]);
        Audit::log('Updated', $customer, $customer->name, "Contact {$contact->name} added");

        return (new ContactResource($contact))->response()->setStatusCode(201);
    }
}
