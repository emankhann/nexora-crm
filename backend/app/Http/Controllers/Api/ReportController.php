<?php

namespace App\Http\Controllers\Api;

use App\Enums\DealStage;
use App\Enums\LeadStatus;
use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GET /api/reports?period=30|90|365|0&owner_id=
 * Pipeline summary, lead conversion and team performance, aggregated in the database.
 * Sales reps only ever get their own numbers.
 */
class ReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'period' => ['nullable', 'integer', 'in:0,30,90,365'],
            'owner_id' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $days = $request->integer('period', 90);
        $since = $days > 0 ? now()->subDays($days) : null;
        $ownerId = $user->role->canViewAll() ? ($request->filled('owner_id') ? $request->integer('owner_id') : null) : $user->id;

        $deals = Deal::query()->when($ownerId, fn ($q) => $q->where('owner_id', $ownerId));
        $leads = Lead::query()->when($ownerId, fn ($q) => $q->where('owner_id', $ownerId))->when($since, fn ($q) => $q->where('created_at', '>=', $since));

        // Pipeline summary: open deals always count; won/lost deals when they closed in the period.
        $byStage = (clone $deals)
            ->where(fn ($q) => $q->whereIn('stage', DealStage::open())
                ->orWhere(fn ($q) => $q->whereNotIn('stage', DealStage::open())->when($since, fn ($q) => $q->where('closed_at', '>=', $since))))
            ->select('stage', DB::raw('COUNT(*) as deals'), DB::raw('SUM(value) as value'), DB::raw('SUM(value * probability / 100) as weighted'), DB::raw('AVG(probability) as avg_probability'))
            ->groupBy('stage')
            ->get()
            ->keyBy(fn ($row) => $row->stage instanceof DealStage ? $row->stage->value : $row->stage);

        $pipeline = collect(DealStage::cases())->map(fn (DealStage $stage) => [
            'stage' => $stage->value,
            'deals' => (int) ($byStage[$stage->value]->deals ?? 0),
            'value' => (float) ($byStage[$stage->value]->value ?? 0),
            'weighted' => round((float) ($byStage[$stage->value]->weighted ?? 0)),
            'avgProbability' => (int) round((float) ($byStage[$stage->value]->avg_probability ?? 0)),
        ]);
        $won = $pipeline->firstWhere('stage', 'won');
        $lost = $pipeline->firstWhere('stage', 'lost');

        $lostReasons = (clone $deals)->where('stage', DealStage::Lost->value)
            ->when($since, fn ($q) => $q->where('closed_at', '>=', $since))
            ->select('lost_reason', DB::raw('COUNT(*) as total'))->groupBy('lost_reason')->orderByDesc('total')->get()
            ->map(fn ($r) => ['reason' => $r->lost_reason ?: 'Not given', 'total' => (int) $r->total]);

        // Lead conversion by source.
        $bySource = (clone $leads)
            ->select('source', DB::raw('COUNT(*) as leads'), DB::raw("SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted"))
            ->groupBy('source')->get()
            ->map(fn ($r) => [
                'source' => $r->source instanceof \BackedEnum ? $r->source->value : $r->source,
                'leads' => (int) $r->leads,
                'converted' => (int) $r->converted,
                'rate' => $r->leads ? (int) round($r->converted / $r->leads * 100) : 0,
            ]);
        $statusCounts = (clone $leads)->select('status', DB::raw('COUNT(*) as total'))->groupBy('status')->pluck('total', 'status');
        $count = fn (array $statuses) => collect($statuses)->sum(fn ($s) => (int) ($statusCounts[$s->value] ?? 0));

        // Team performance.
        $team = User::query()
            ->where('status', 'active')
            ->when($ownerId, fn ($q) => $q->whereKey($ownerId))
            ->orderBy('name')
            ->get()
            ->map(function (User $u) use ($since) {
                $wonQuery = Deal::where('owner_id', $u->id)->where('stage', DealStage::Won->value)->when($since, fn ($q) => $q->where('closed_at', '>=', $since));
                $lostCount = Deal::where('owner_id', $u->id)->where('stage', DealStage::Lost->value)->when($since, fn ($q) => $q->where('closed_at', '>=', $since))->count();
                $wonCount = (clone $wonQuery)->count();
                $leadQuery = Lead::where('owner_id', $u->id)->when($since, fn ($q) => $q->where('created_at', '>=', $since));

                return [
                    'userId' => $u->id,
                    'name' => $u->shortName(),
                    'role' => $u->role->label(),
                    'leads' => (clone $leadQuery)->count(),
                    'converted' => (clone $leadQuery)->where('status', LeadStatus::Converted->value)->count(),
                    'won' => $wonCount,
                    'revenue' => (float) (clone $wonQuery)->sum('value'),
                    'winRate' => $wonCount + $lostCount > 0 ? (int) round($wonCount / ($wonCount + $lostCount) * 100) : null,
                    'pipeline' => (float) Deal::where('owner_id', $u->id)->open()->sum('value'),
                    'tasksDone' => Task::where('assigned_to', $u->id)->whereNotNull('completed_at')->when($since, fn ($q) => $q->where('completed_at', '>=', $since))->count(),
                ];
            });

        $openStages = $pipeline->whereIn('stage', array_map(fn ($s) => $s->value, DealStage::open()));

        return response()->json([
            'period' => $days,
            'summary' => [
                'openValue' => $openStages->sum('value'),
                'openDeals' => $openStages->sum('deals'),
                'weightedForecast' => $openStages->sum('weighted'),
                'winRate' => ($won['deals'] + $lost['deals']) > 0 ? (int) round($won['deals'] / ($won['deals'] + $lost['deals']) * 100) : null,
                'averageWon' => $won['deals'] ? round($won['value'] / $won['deals']) : 0,
            ],
            'pipeline' => $pipeline->values(),
            'lostReasons' => $lostReasons,
            'conversion' => [
                'funnel' => [
                    ['name' => 'All leads', 'count' => $statusCounts->sum()],
                    ['name' => 'Contacted or later', 'count' => $count([LeadStatus::Contacted, LeadStatus::Qualified, LeadStatus::Converted])],
                    ['name' => 'Qualified or later', 'count' => $count([LeadStatus::Qualified, LeadStatus::Converted])],
                    ['name' => 'Converted', 'count' => $count([LeadStatus::Converted])],
                ],
                'bySource' => $bySource->values(),
            ],
            'team' => $team->values(),
        ]);
    }
}
