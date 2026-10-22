<?php

namespace Tests\Feature;

use App\Enums\DealStage;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Services\LeadScorer;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The demo data must tell the truth about the app: what a reviewer sees on screen has to
 * match what the app itself would work out.
 */
class DemoDataTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_every_demo_lead_score_equals_the_sum_of_its_breakdown(): void
    {
        $leads = Lead::all();
        $this->assertNotEmpty($leads);

        foreach ($leads as $lead) {
            $sum = array_sum(array_column($lead->score_factors ?? [], 'points'));
            $this->assertSame(min(100, $sum), $lead->score, "{$lead->name}: score {$lead->score}, breakdown adds up to {$sum}");
        }
    }

    public function test_demo_leads_are_scored_by_the_same_rules_as_new_leads(): void
    {
        $scorer = new LeadScorer;

        foreach (Lead::all() as $lead) {
            $expected = $scorer->score($lead->source, $lead->status, $lead->job_title, $lead->company_size, $lead->phone, $lead->email);
            $this->assertTrue($lead->auto_score, "{$lead->name} should rescore like any lead");
            $this->assertSame($expected['score'], $lead->score, "{$lead->name}'s score");
            $this->assertSame($expected['factors'], $lead->score_factors, "{$lead->name}'s breakdown");
        }

        // The demo story: Ayesha Raza is the top lead, and the dashboard has several hot leads.
        $this->assertSame('Ayesha Raza', Lead::orderByDesc('score')->first()->name);
        $this->assertSame(95, Lead::where('name', 'Ayesha Raza')->value('score'));
        $this->assertGreaterThanOrEqual(3, Lead::where('score', '>=', 80)->count());
    }

    public function test_open_deal_counts_only_come_from_real_deals(): void
    {
        $this->assertFalse(Schema::hasColumn('customers', 'legacy_open_deals'));

        $huma = User::where('email', 'huma@nexora.example')->firstOrFail();
        $customers = $this->actingAs($huma)->getJson('/api/crm')->assertOk()->json('customers');
        foreach ($customers as $customer) {
            $this->assertArrayNotHasKey('legacyOpenDeals', $customer, "{$customer['name']} still has a made-up open-deal count");
        }
    }

    public function test_dated_next_steps_on_open_deals_are_upcoming_whenever_you_seed(): void
    {
        $today = now(config('app.local_timezone'))->startOfDay();

        $dated = Deal::whereIn('stage', array_map(fn (DealStage $s) => $s->value, array_filter(DealStage::cases(), fn (DealStage $s) => $s->isOpen())))
            ->get()
            ->filter(fn (Deal $d) => preg_match('/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/', $d->next_step ?? ''));
        $this->assertNotEmpty($dated);

        foreach ($dated as $deal) {
            preg_match('/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b/', $deal->next_step, $m);
            // "Oct 25" has no year: take the next such day from today (so a seed in late December works too).
            $date = Carbon::createFromFormat('M j Y', "{$m[1]} {$m[2]} {$today->year}", config('app.local_timezone'))->startOfDay();
            if ($date->lt($today->copy()->subDays(7))) {
                $date->addYear();
            }
            $this->assertTrue($date->gte($today), "{$deal->title}: next step \"{$deal->next_step}\" is in the past");
        }
    }
}
