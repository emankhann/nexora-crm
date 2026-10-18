<?php

namespace Tests\Unit;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Services\LeadScorer;
use PHPUnit\Framework\TestCase;

/**
 * The lead-scoring rules on their own, without a database: each rule adds its points,
 * and every point is explained by a factor the UI can show.
 */
class LeadScorerTest extends TestCase
{
    private function score(LeadSource $source, LeadStatus $status, ?string $title, ?string $size, ?string $phone, ?string $email): array
    {
        return (new LeadScorer)->score($source, $status, $title, $size, $phone, $email);
    }

    public function test_a_strong_lead_scores_every_rule_and_explains_each_point(): void
    {
        $result = $this->score(LeadSource::Referral, LeadStatus::Qualified, 'Operations Director', '200+', '+92 300 555 0142', 'ayesha@cedarlogistics.example');

        // 25 referral + 25 qualified + 20 company size + 15 decision maker + 5 phone + 5 work email
        $this->assertSame(95, $result['score']);
        $this->assertCount(6, $result['factors']);
        $this->assertSame($result['score'], array_sum(array_column($result['factors'], 'points')));
        $this->assertSame('Came from referral', $result['factors'][0]['label']);
        $this->assertContains('Decision maker (Operations Director)', array_column($result['factors'], 'label'));
    }

    public function test_a_weak_lead_only_gets_points_for_its_source(): void
    {
        $result = $this->score(LeadSource::ColdEmail, LeadStatus::New, 'Intern', null, null, 'someone@gmail.com');

        $this->assertSame(5, $result['score']);
        $this->assertSame([['label' => 'Came from cold email', 'points' => 5]], $result['factors']);
    }

    public function test_free_email_addresses_and_junior_titles_add_nothing(): void
    {
        $work = $this->score(LeadSource::Website, LeadStatus::New, 'Head of Operations', null, null, 'omar@company.example');
        $free = $this->score(LeadSource::Website, LeadStatus::New, 'Sales Assistant', null, null, 'omar@yahoo.com');

        $this->assertSame(10 + 15 + 5, $work['score']);
        $this->assertSame(10, $free['score']);
    }
}
