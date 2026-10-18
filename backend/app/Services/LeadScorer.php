<?php

namespace App\Services;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;

/**
 * Explainable lead scoring: a few simple rules, each worth some points.
 * The factors are saved with the lead so the UI can show *why* it scored what it did.
 * Runs on the server only: leads are scored when they are created or imported, and scored
 * again when their details or status change (while auto_score is on).
 */
class LeadScorer
{
    private const FREE_MAIL = '/@(gmail|yahoo|hotmail|outlook|live|icloud)\./i';

    private const DECISION_MAKER = '/(director|head|chief|ceo|cto|coo|cfo|founder|owner|vp|president|partner)/i';

    /**
     * @return array{score: int, factors: list<array{label: string, points: int}>}
     */
    public function score(
        LeadSource $source,
        LeadStatus $status,
        ?string $jobTitle,
        ?string $companySize,
        ?string $phone,
        ?string $email,
    ): array {
        $factors = [];

        $sourcePoints = match ($source) {
            LeadSource::Referral => 25,
            LeadSource::Event => 15,
            LeadSource::LinkedIn => 12,
            LeadSource::Website => 10,
            LeadSource::ColdEmail => 5,
        };
        $factors[] = ['label' => 'Came from '.strtolower($source->label()), 'points' => $sourcePoints];

        if ($status === LeadStatus::Qualified) {
            $factors[] = ['label' => 'Qualified by the sales team', 'points' => 25];
        } elseif ($status === LeadStatus::Contacted) {
            $factors[] = ['label' => 'Has replied or taken a call', 'points' => 12];
        }

        $sizePoints = match ($companySize) {
            '200+' => ['Company size: 200 or more employees', 20],
            '51-200', '51–200' => ['Company size: 51 to 200 employees', 12],
            '1-50', '1–50' => ['Company size: up to 50 employees', 5],
            default => null,
        };
        if ($sizePoints) {
            $factors[] = ['label' => $sizePoints[0], 'points' => $sizePoints[1]];
        }

        if ($jobTitle && preg_match(self::DECISION_MAKER, $jobTitle)) {
            $factors[] = ['label' => "Decision maker ({$jobTitle})", 'points' => 15];
        }
        if ($phone && trim($phone) !== '') {
            $factors[] = ['label' => 'Phone number on file', 'points' => 5];
        }
        if ($email && ! preg_match(self::FREE_MAIL, $email)) {
            $factors[] = ['label' => 'Uses a work email', 'points' => 5];
        }

        usort($factors, fn ($a, $b) => $b['points'] <=> $a['points']);

        return [
            'score' => min(100, array_sum(array_column($factors, 'points'))),
            'factors' => $factors,
        ];
    }
}
