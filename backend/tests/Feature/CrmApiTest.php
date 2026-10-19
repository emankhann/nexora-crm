<?php

namespace Tests\Feature;

use App\Enums\LeadStatus;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * End-to-end checks of the API's most important rules: sign-in, role-based data access,
 * permissions, lead conversion and pipeline maths. Run with:  php artisan test
 *
 * Uses an in-memory SQLite database (see phpunit.xml), so it never touches your MySQL data.
 */
class CrmApiTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    public function test_sign_in_works_with_the_demo_password(): void
    {
        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/login', ['email' => 'huma@nexora.example', 'password' => 'demo1234'])
            ->assertOk()
            ->assertJsonPath('data.role', 'admin');
    }

    public function test_sign_in_rejects_a_wrong_password(): void
    {
        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/login', ['email' => 'huma@nexora.example', 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_pending_invites_cannot_sign_in(): void
    {
        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/login', ['email' => 'kamran@nexora.example', 'password' => 'demo1234'])
            ->assertStatus(422);
    }

    public function test_the_api_requires_sign_in(): void
    {
        $this->getJson('/api/crm')->assertUnauthorized();
    }

    public function test_sales_reps_only_receive_their_own_leads(): void
    {
        $sana = $this->user('sana@nexora.example');

        $leads = $this->actingAs($sana)->getJson('/api/crm')->assertOk()->json('leads');

        $this->assertNotEmpty($leads);
        $this->assertSame([$sana->id], array_values(array_unique(array_column($leads, 'ownerId'))));
    }

    public function test_people_with_the_same_short_name_are_kept_apart_by_id(): void
    {
        $sana = $this->user('sana@nexora.example');
        $twin = User::factory()->create(['name' => 'Sana Mughal', 'email' => 'twin@nexora.example', 'role' => $sana->role, 'status' => $sana->status]);
        $this->assertSame($sana->shortName(), $twin->shortName());

        $lead = $this->actingAs($this->user('huma@nexora.example'))->postJson('/api/leads', [
            'name' => 'Twin Check',
            'email' => 'twin-check@example.com',
            'company' => 'Twin Ltd',
            'source' => 'website',
            'status' => 'new',
            'owner_id' => $twin->id,
        ])->assertCreated()->json('data');
        $this->assertSame($twin->id, $lead['ownerId']);

        $crm = $this->actingAs($this->user('huma@nexora.example'))->getJson('/api/crm')->assertOk();
        // The frontend compares people by these ids, never by short name.
        $this->assertArrayHasKey('createdById', $crm->json('tasks.0'));
        $this->assertArrayHasKey('byId', $crm->json('activities.0'));

        $this->actingAs($sana);
        $this->assertNotContains($lead['id'], array_column($this->getJson('/api/crm')->json('leads'), 'id'));
        $this->actingAs($twin);
        $this->assertContains($lead['id'], array_column($this->getJson('/api/crm')->json('leads'), 'id'));
    }

    public function test_admins_receive_every_lead(): void
    {
        $leads = $this->actingAs($this->user('huma@nexora.example'))->getJson('/api/crm')->json('leads');

        $this->assertCount(Lead::count(), $leads);
    }

    public function test_a_sales_rep_cannot_edit_someone_elses_lead(): void
    {
        $sana = $this->user('sana@nexora.example');
        $othersLead = Lead::where('owner_id', '!=', $sana->id)->whereNotNull('owner_id')->firstOrFail();

        $this->actingAs($sana)
            ->putJson("/api/leads/{$othersLead->id}", [
                'name' => 'Changed', 'email' => $othersLead->email, 'company' => 'X',
                'source' => 'website', 'status' => 'new',
            ])
            ->assertForbidden();
    }

    public function test_only_admins_can_delete_leads(): void
    {
        $lead = Lead::firstOrFail();

        $this->actingAs($this->user('omar@nexora.example'))->deleteJson("/api/leads/{$lead->id}")->assertForbidden();
        $this->actingAs($this->user('huma@nexora.example'))->deleteJson("/api/leads/{$lead->id}")->assertNoContent();
        $this->assertSoftDeleted($lead);
    }

    public function test_new_leads_are_scored_and_validated(): void
    {
        $huma = $this->user('huma@nexora.example');

        $this->actingAs($huma)->postJson('/api/leads', ['name' => '', 'email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'company', 'source', 'status']);

        $response = $this->actingAs($huma)->postJson('/api/leads', [
            'name' => 'Test Person', 'email' => 'test@acme.io', 'company' => 'Acme', 'company_size' => '200+',
            'job_title' => 'CEO', 'source' => 'referral', 'status' => 'new',
        ])->assertCreated();

        $this->assertGreaterThan(0, $response->json('data.score'));
        $this->assertNotEmpty($response->json('data.factors'));
    }

    public function test_converting_a_lead_creates_a_customer_and_a_deal(): void
    {
        $huma = $this->user('huma@nexora.example');
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail();
        $lead->update(['status' => LeadStatus::Qualified]);

        $this->actingAs($huma)->postJson("/api/leads/{$lead->id}/convert", [
            'mode' => 'new',
            'industry' => 'Healthcare',
            'create_deal' => true,
            'deal' => ['title' => 'Clinic CRM', 'value' => 5000, 'stage' => 'won', 'close_date' => now()->toDateString()],
        ])->assertCreated();

        $customer = Customer::where('name', 'Harbor Dental')->firstOrFail();
        $this->assertSame('converted', $lead->fresh()->status->value);
        $this->assertEquals(5000, (float) $customer->lifetime_value);
        $this->assertTrue($customer->contacts()->where('email', $lead->email)->exists());
    }

    public function test_a_lead_must_be_qualified_before_it_can_be_converted(): void
    {
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail(); // New
        $huma = $this->user('huma@nexora.example');

        $this->actingAs($huma)->postJson("/api/leads/{$lead->id}/convert", ['mode' => 'new', 'industry' => 'Healthcare'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Qualify this lead before converting it.');
        $this->assertSame('new', $lead->fresh()->status->value);
        $this->assertSame(0, Customer::where('name', 'Harbor Dental')->count());
    }

    public function test_logging_a_call_on_a_new_lead_moves_it_to_contacted(): void
    {
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail(); // New, Sana's
        $lead->update(['auto_score' => true]); // demo leads keep hand-picked scores; this one should be rescored
        $sana = $this->user('sana@nexora.example');

        $this->actingAs($sana)->postJson('/api/activities', ['type' => 'note', 'title' => 'Just a note', 'lead_id' => $lead->id])->assertCreated();
        $this->assertSame('new', $lead->fresh()->status->value, 'a note is not contact');

        $this->actingAs($sana)->postJson('/api/activities', ['type' => 'call', 'title' => 'Call logged: interested', 'lead_id' => $lead->id])->assertCreated();
        $fresh = $lead->fresh();
        $this->assertSame('contacted', $fresh->status->value);
        $this->assertNotNull($fresh->contacted_at);
        $this->assertContains('Has replied or taken a call', array_column($fresh->score_factors, 'label'));
        $this->assertTrue($fresh->activities()->where('title', 'Status changed from New to Contacted')->exists());

        // Already contacted: another call doesn't change it again.
        $this->actingAs($sana)->postJson('/api/activities', ['type' => 'email', 'title' => 'Email sent: follow-up', 'lead_id' => $lead->id])->assertCreated();
        $this->assertSame(1, $fresh->activities()->where('title', 'Status changed from New to Contacted')->count());
    }

    public function test_editing_a_converted_lead_keeps_it_converted(): void
    {
        $huma = $this->user('huma@nexora.example');
        $lead = Lead::where('company', 'Harbor Dental')->firstOrFail();
        $lead->update(['status' => LeadStatus::Qualified]);
        $this->actingAs($huma)->postJson("/api/leads/{$lead->id}/convert", ['mode' => 'new', 'industry' => 'Healthcare'])->assertSuccessful();

        $this->actingAs($huma)->putJson("/api/leads/{$lead->id}", [
            'name' => 'Sara Iqbal', 'email' => $lead->email, 'company' => 'Harbor Dental',
            'source' => 'cold_email', 'job_title' => 'Practice Owner',
        ])->assertOk();

        $this->assertSame('converted', $lead->fresh()->status->value);
        $this->assertSame('Practice Owner', $lead->fresh()->job_title);
    }

    public function test_a_sales_rep_cannot_link_records_they_cannot_see(): void
    {
        $sana = $this->user('sana@nexora.example');
        $othersCustomer = Customer::where('name', 'Meridian Textiles')->firstOrFail(); // Omar's
        $othersDeal = Deal::where('title', 'Fleet tracking portal')->firstOrFail();    // Huma's
        $ownLead = Lead::where('company', 'Harbor Dental')->firstOrFail();             // Sana's
        $ownLead->update(['status' => LeadStatus::Qualified]);                         // so only the customer check can stop it

        // A deal on someone else's customer.
        $this->actingAs($sana)->postJson('/api/deals', [
            'title' => 'Sneaky deal', 'company' => 'Meridian Textiles', 'value' => 1000, 'stage' => 'won',
            'expected_close_date' => now()->toDateString(), 'customer_id' => $othersCustomer->id,
        ])->assertForbidden();

        // A task on someone else's deal.
        $this->actingAs($sana)->postJson('/api/tasks', [
            'title' => 'Sneaky task', 'type' => 'call', 'priority' => 'low', 'due_at' => now()->addDay()->toIso8601String(),
            'reminder' => 'none', 'deal_id' => $othersDeal->id,
        ])->assertForbidden();

        // Converting her own lead into someone else's customer.
        $this->actingAs($sana)->postJson("/api/leads/{$ownLead->id}/convert", [
            'mode' => 'existing', 'customer_id' => $othersCustomer->id,
        ])->assertForbidden();

        $this->assertSame(0, Deal::where('title', 'Sneaky deal')->count());
        $this->assertNotSame('converted', $ownLead->fresh()->status->value);
    }

    public function test_winning_a_deal_adds_to_the_customers_lifetime_value(): void
    {
        $deal = Deal::where('title', 'Social media retainer')->firstOrFail();
        $before = (float) $deal->customer->lifetime_value;

        $this->actingAs($this->user('huma@nexora.example'))
            ->postJson("/api/deals/{$deal->id}/move", ['stage' => 'won'])
            ->assertOk()
            ->assertJsonPath('data.stage', 'won');

        $this->assertEquals($before + (float) $deal->value, (float) $deal->customer->fresh()->lifetime_value);
    }

    public function test_losing_a_deal_needs_a_reason(): void
    {
        $deal = Deal::where('title', 'Booking engine')->firstOrFail();

        $this->actingAs($this->user('huma@nexora.example'))
            ->postJson("/api/deals/{$deal->id}/move", ['stage' => 'lost'])
            ->assertStatus(422);
    }

    public function test_only_admins_can_see_the_audit_log_and_manage_the_team(): void
    {
        $omar = $this->user('omar@nexora.example');

        $this->actingAs($omar)->getJson('/api/audit-log')->assertForbidden();
        $this->actingAs($omar)->postJson('/api/team/invite', ['name' => 'A', 'email' => 'a@b.co', 'role' => 'sales_rep'])->assertForbidden();
        $this->actingAs($this->user('huma@nexora.example'))->getJson('/api/audit-log')->assertOk();
    }

    public function test_the_last_admin_cannot_be_demoted_and_you_cannot_change_your_own_role(): void
    {
        $huma = $this->user('huma@nexora.example');
        $omar = $this->user('omar@nexora.example');

        $this->actingAs($huma)->patchJson("/api/team/{$huma->id}/role", ['role' => 'manager'])->assertStatus(422);
        $this->actingAs($huma)->patchJson("/api/team/{$omar->id}/role", ['role' => 'admin'])->assertOk();
        $this->assertSame('admin', $omar->fresh()->role->value);
    }

    public function test_reports_return_pipeline_conversion_and_team_numbers(): void
    {
        $this->actingAs($this->user('huma@nexora.example'))
            ->getJson('/api/reports?period=365')
            ->assertOk()
            ->assertJsonStructure(['summary' => ['openValue', 'weightedForecast'], 'pipeline', 'conversion' => ['funnel', 'bySource'], 'team']);
    }
}
