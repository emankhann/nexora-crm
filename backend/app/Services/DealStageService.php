<?php

namespace App\Services;

use App\Enums\ActivityType;
use App\Enums\DealStage;
use App\Models\Deal;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Moves a deal between pipeline stages and keeps related numbers right:
 * probability follows the stage, won deals add to the customer's lifetime value,
 * and every move is written to the history and audit log.
 */
class DealStageService
{
    public function __construct(private ActivityRecorder $activities) {}

    public function move(Deal $deal, DealStage $to, ?string $lostReason = null): Deal
    {
        $from = $deal->stage;
        if ($from === $to) {
            return $deal;
        }

        return DB::transaction(function () use ($deal, $from, $to, $lostReason) {
            $closing = ! $to->isOpen();

            // Re-opening a won deal takes its value back off the customer.
            if ($from === DealStage::Won && $deal->customer) {
                $deal->customer->decrement('lifetime_value', $deal->value);
            }

            $deal->update([
                'stage' => $to,
                'probability' => $to->probability(),
                'closed_at' => $closing ? now() : null,
                'lost_reason' => $to === DealStage::Lost ? ($lostReason ?: 'Not given') : null,
                'next_step' => match ($to) {
                    DealStage::Won => 'Won',
                    DealStage::Lost => 'Lost · '.($lostReason ?: 'No reason'),
                    default => $deal->next_step,
                },
            ]);

            if ($to === DealStage::Won && $deal->customer) {
                $deal->customer->increment('lifetime_value', $deal->value);
            }

            $title = match ($to) {
                DealStage::Won => "Deal won: {$deal->title}",
                DealStage::Lost => "Deal lost: {$deal->title}",
                default => "{$deal->title} moved to {$to->label()}",
            };
            $this->activities->record(
                ActivityType::Deal,
                $title,
                $to === DealStage::Lost ? 'Reason: '.($lostReason ?: 'Not given') : "From {$from->label()}",
                ['deal_id' => $deal->id, 'lead_id' => $deal->lead_id, 'customer_id' => $deal->customer_id],
            );
            Audit::log('Deal moved', $deal, $deal->title, "{$from->label()} to {$to->label()}".($lostReason ? " ({$lostReason})" : ''));

            return $deal->refresh();
        });
    }
}
