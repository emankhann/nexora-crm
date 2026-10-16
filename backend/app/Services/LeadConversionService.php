<?php

namespace App\Services;

use App\Enums\ActivityType;
use App\Enums\CustomerHealth;
use App\Enums\DealStage;
use App\Enums\DealTemperature;
use App\Enums\LeadStatus;
use App\Models\Activity;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Turns a qualified lead into a customer (new or existing) and optionally opens a deal.
 * Everything happens in one database transaction, so a failure never leaves half a conversion.
 */
class LeadConversionService
{
    public function __construct(private ActivityRecorder $activities) {}

    /**
     * @param  array{mode: string, customer_id?: int|null, industry?: string|null, owner_id: int, create_deal: bool, deal?: array{title: string, value: float, stage: string, close_date: string}}  $data
     */
    public function convert(Lead $lead, array $data, User $actor): Customer
    {
        return DB::transaction(function () use ($lead, $data, $actor) {
            $customer = $data['mode'] === 'existing'
                ? Customer::findOrFail($data['customer_id'])
                : Customer::create([
                    'name' => $lead->company,
                    'industry' => $data['industry'] ?? 'Other',
                    'size' => $lead->company_size,
                    'health' => CustomerHealth::Healthy,
                    'owner_id' => $data['owner_id'],
                    'lead_id' => $lead->id,
                    'customer_since' => now()->toDateString(),
                ]);

            // The lead's contact becomes a contact at the customer (primary if it's a new customer).
            if (! $customer->contacts()->where('email', $lead->email)->exists()) {
                $customer->contacts()->create([
                    'name' => $lead->name,
                    'job_title' => $lead->job_title,
                    'email' => $lead->email,
                    'phone' => $lead->phone,
                    'is_primary' => $data['mode'] !== 'existing',
                ]);
            }

            $deal = null;
            if (! empty($data['create_deal'])) {
                $stage = DealStage::from($data['deal']['stage']);
                $deal = Deal::create([
                    'title' => $data['deal']['title'],
                    'company' => $lead->company,
                    'value' => $data['deal']['value'],
                    'stage' => $stage,
                    'probability' => $stage->probability(),
                    'temperature' => $lead->score >= 80 ? DealTemperature::Hot : ($lead->score >= 50 ? DealTemperature::Warm : DealTemperature::Cold),
                    'expected_close_date' => $data['deal']['close_date'],
                    'next_step' => 'Kickoff after conversion',
                    'owner_id' => $data['owner_id'],
                    'lead_id' => $lead->id,
                    'customer_id' => $customer->id,
                    'closed_at' => $stage === DealStage::Won ? now() : null,
                ]);
                if ($stage === DealStage::Won) {
                    $customer->increment('lifetime_value', $deal->value);
                }
            }

            // The lead's existing deals, tasks and history now belong to the customer too.
            Deal::where('lead_id', $lead->id)->whereNull('customer_id')->update(['customer_id' => $customer->id]);
            Task::where('lead_id', $lead->id)->whereNull('customer_id')->update(['customer_id' => $customer->id]);
            Activity::where('lead_id', $lead->id)->whereNull('customer_id')->update(['customer_id' => $customer->id]);

            $lead->update([
                'status' => LeadStatus::Converted,
                'customer_id' => $customer->id,
                'converted_at' => now(),
                'last_activity_at' => now(),
            ]);

            $this->activities->record(
                ActivityType::Converted,
                "Converted to customer: {$customer->name}",
                "{$lead->name} · by {$actor->shortName()}",
                ['lead_id' => $lead->id, 'customer_id' => $customer->id, 'deal_id' => $deal?->id],
            );
            Audit::log('Converted', $customer, $customer->name, "{$lead->name} became a customer");

            return $customer;
        });
    }
}
