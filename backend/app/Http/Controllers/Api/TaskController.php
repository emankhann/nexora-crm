<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityType;
use App\Enums\TaskType;
use App\Http\Controllers\Controller;
use App\Http\Requests\TaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssigned;
use App\Services\ActivityRecorder;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    private const RELATIONS = ['assignee', 'creator', 'lead', 'customer.primaryContact', 'followUps.user'];

    public function __construct(private ActivityRecorder $activities) {}

    /** GET /api/tasks?bucket=today|overdue|upcoming|done&assigned_to= */
    public function index(Request $request): AnonymousResourceCollection
    {
        $bucket = $request->input('bucket');

        $tasks = Task::visibleTo($request->user())
            ->with(self::RELATIONS)
            ->when($bucket === 'done', fn ($q) => $q->whereNotNull('completed_at'), fn ($q) => $q->whereNull('completed_at'))
            ->when($bucket === 'today', fn ($q) => $q->whereBetween('due_at', [now(), now()->endOfDay()]))
            ->when($bucket === 'overdue', fn ($q) => $q->where('due_at', '<', now()))
            ->when($bucket === 'upcoming', fn ($q) => $q->where('due_at', '>', now()->endOfDay()))
            ->when($request->filled('assigned_to'), fn ($q) => $q->where('assigned_to', $request->integer('assigned_to')))
            ->orderBy('due_at')
            ->paginate(min(100, $request->integer('per_page', 50)));

        return TaskResource::collection($tasks);
    }

    public function show(Task $task): TaskResource
    {
        Gate::authorize('view', $task);

        return new TaskResource($task->load(self::RELATIONS));
    }

    /**
     * POST /api/tasks. With notify: true, a task for someone else emails them (TaskAssigned).
     */
    public function store(TaskRequest $request): JsonResponse
    {
        Gate::authorize('create', Task::class);
        $data = $request->safe()->except('notify');
        $user = $request->user();
        $this->authorizeLinks($data);

        // Reps can only assign tasks to themselves.
        $assignee = Gate::allows('reassign') ? ($data['assigned_to'] ?? $user->id) : $user->id;

        $task = DB::transaction(function () use ($data, $user, $assignee) {
            $task = Task::create([...$data, 'assigned_to' => $assignee, 'created_by' => $user->id]);

            if ((int) $assignee !== (int) $user->id) {
                $name = User::find($assignee)?->shortName();
                $this->activities->record(ActivityType::Assigned, "Task assigned to {$name}: {$task->title}", "By {$user->shortName()}", [
                    'task_id' => $task->id, 'lead_id' => $task->lead_id, 'assignee_id' => $assignee,
                ]);
            }
            Audit::log('Task created', $task, $task->title, 'Assigned to '.User::find($assignee)?->shortName());

            return $task;
        });

        $task->load(self::RELATIONS);
        $this->emailAssignee($request, $task);

        return (new TaskResource($task))->response()->setStatusCode(201);
    }

    /**
     * PUT /api/tasks/{task}. With notify: true, giving the task to someone else emails them;
     * editing anything else sends nothing.
     */
    public function update(TaskRequest $request, Task $task): TaskResource
    {
        Gate::authorize('update', $task);
        $data = $request->safe()->except('notify');
        $this->authorizeLinks($data);

        $reassigned = isset($data['assigned_to']) && (int) $data['assigned_to'] !== (int) $task->assigned_to;
        if ($reassigned) {
            Gate::authorize('reassign');
        } else {
            unset($data['assigned_to']);
        }

        $task->update($data);
        Audit::log('Updated', $task, $task->title, 'Task edited');

        $task->load(self::RELATIONS);
        if ($reassigned) {
            $this->emailAssignee($request, $task);
        }

        return new TaskResource($task);
    }

    /** Emails the assignee about their new task, unless notify is off or they assigned it to themselves. */
    private function emailAssignee(Request $request, Task $task): void
    {
        $user = $request->user();
        if ($request->boolean('notify') && $task->assignee && $task->assignee->id !== $user->id) {
            $task->assignee->notify(new TaskAssigned($task, $user->name));
        }
    }

    /** POST /api/tasks/{task}/toggle: mark done or reopen. */
    public function toggle(Task $task): TaskResource
    {
        Gate::authorize('update', $task);
        $done = $task->completed_at === null;
        $task->update(['completed_at' => $done ? now() : null]);

        if ($task->lead_id) {
            Lead::whereKey($task->lead_id)->update(['last_activity_at' => now()]);
        }
        if ($done) {
            Audit::log('Task completed', $task, $task->title, 'Completed by '.request()->user()->shortName());
        }

        return new TaskResource($task->load(self::RELATIONS));
    }

    /**
     * POST /api/tasks/{task}/follow-ups  { outcome, note?, reschedule_to?, close? }
     * Logs an attempt, moves the due date (or closes the task) and adds it to the
     * related lead's/customer's communication history.
     */
    public function followUp(Request $request, Task $task): TaskResource
    {
        Gate::authorize('update', $task);
        $data = $request->validate([
            'outcome' => ['required', 'string', 'max:50'],
            'note' => ['nullable', 'string', 'max:2000'],
            'reschedule_to' => ['nullable', 'date'],
            'close' => ['boolean'],
        ]);
        $user = $request->user();

        DB::transaction(function () use ($task, $data, $user) {
            $task->followUps()->create([
                'user_id' => $user->id,
                'outcome' => $data['outcome'],
                'note' => $data['note'] ?? null,
                'rescheduled_to' => $data['reschedule_to'] ?? null,
            ]);
            $task->update([
                'due_at' => $data['reschedule_to'] ?? $task->due_at,
                'completed_at' => ! empty($data['close']) ? now() : $task->completed_at,
            ]);

            if ($task->lead_id || $task->customer_id) {
                $type = match ($task->type) {
                    TaskType::Email => ActivityType::Email,
                    TaskType::Meeting => ActivityType::Meeting,
                    default => ActivityType::Call,
                };
                $this->activities->record($type, "{$task->title}: {$data['outcome']}", $data['note'] ?? "Follow-up by {$user->shortName()}", [
                    'lead_id' => $task->lead_id, 'customer_id' => $task->customer_id, 'task_id' => $task->id,
                ]);
            }
        });

        return new TaskResource($task->load(self::RELATIONS));
    }

    public function destroy(Task $task): Response
    {
        Gate::authorize('delete', $task);
        $task->delete();
        Audit::log('Deleted', $task, $task->title, 'Task deleted');

        return response()->noContent();
    }

    /** A task can only be linked to records the user is allowed to see. */
    private function authorizeLinks(array $data): void
    {
        if (! empty($data['lead_id'])) {
            Gate::authorize('view', Lead::findOrFail($data['lead_id']));
        }
        if (! empty($data['customer_id'])) {
            Gate::authorize('view', Customer::findOrFail($data['customer_id']));
        }
        if (! empty($data['deal_id'])) {
            Gate::authorize('view', Deal::findOrFail($data['deal_id']));
        }
    }
}
