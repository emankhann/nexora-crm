<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityResource;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\DealResource;
use App\Http\Resources\LeadResource;
use App\Http\Resources\TaskResource;
use App\Http\Resources\UserResource;
use App\Models\Activity;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\NotificationRead;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/crm: everything the signed-in user is allowed to see, in one request.
 *
 * The frontend loads this once and keeps it in its store, so screens are instant and
 * dashboards/reports can be worked out without extra round trips. Every list is filtered
 * by the same visibleTo() rules the other endpoints use, so a sales rep never receives
 * another rep's data. For a much larger dataset this would switch to the paginated
 * per-resource endpoints (GET /api/leads?page=2 …), which already exist.
 */
class BootstrapController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['last_active_at' => now()])->saveQuietly();

        $leads = Lead::visibleTo($user)->with('owner')->latest('last_activity_at')->get();
        $customers = Customer::visibleTo($user)->with(['owner', 'contacts'])->orderBy('name')->get();
        $deals = Deal::visibleTo($user)->with('owner')->get();
        $tasks = Task::visibleTo($user)
            ->with(['assignee', 'creator', 'lead', 'customer.primaryContact', 'followUps.user'])
            ->orderBy('due_at')->get();

        $leadIds = $leads->pluck('id');
        $customerIds = $customers->pluck('id');
        $activities = Activity::with(['user', 'assignee'])
            ->when(! $user->role->canViewAll(), fn ($q) => $q->where(fn ($q) => $q
                ->whereIn('lead_id', $leadIds)
                ->orWhereIn('customer_id', $customerIds)
                ->orWhere('user_id', $user->id)
                ->orWhere('assignee_id', $user->id)))
            ->latest('occurred_at')->limit(400)->get();

        return response()->json([
            'user' => new UserResource($user),
            'leads' => LeadResource::collection($leads),
            'customers' => CustomerResource::collection($customers),
            'deals' => DealResource::collection($deals),
            'tasks' => TaskResource::collection($tasks),
            'activities' => ActivityResource::collection($activities),
            'audit' => Gate::allows('view-audit-log')
                ? AuditLogResource::collection(AuditLog::with('user')->latest('created_at')->limit(300)->get())
                : [],
            'members' => UserResource::collection(User::orderBy('id')->get()),
            'readNotices' => NotificationRead::where('user_id', $user->id)->pluck('notice_key'),
        ]);
    }
}
