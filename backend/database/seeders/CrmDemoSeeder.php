<?php

namespace Database\Seeders;

use App\Enums\ActivityType;
use App\Enums\CustomerHealth;
use App\Enums\DealStage;
use App\Enums\DealTemperature;
use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Enums\Reminder;
use App\Enums\TaskPriority;
use App\Enums\TaskType;
use App\Models\Activity;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use App\Services\LeadScorer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample CRM data matching the frontend demo. Dates are relative to "now"
 * so the dashboard always has tasks due today, overdue deals, etc.
 */
class CrmDemoSeeder extends Seeder
{
    public function run(): void
    {
        // Seeding sets created_at / updated_at by hand so the demo has realistic history.
        Model::unguarded(fn () => $this->seed());
    }

    private function seed(): void
    {
        $users = User::whereIn('email', ['huma@nexora.example', 'omar@nexora.example', 'sana@nexora.example'])
            ->get()->keyBy('email');
        $huma = $users['huma@nexora.example'];
        $omar = $users['omar@nexora.example'];
        $sana = $users['sana@nexora.example'];

        // Times of day ("due at 5 PM") are meant in the demo's local time zone, then stored in UTC.
        $tz = config('app.local_timezone', 'UTC');
        $at = fn (int $days, int $hour = 10, int $minute = 0): Carbon => now($tz)->addDays($days)->setTime($hour, $minute)->utc();
        // "Oct 25": a day this many days from the seed day, for texts like a deal's next step.
        $day = fn (int $days): string => now($tz)->addDays($days)->format('M j');
        $scorer = new LeadScorer;

        /* ---------------- Customers and contacts ---------------- */

        $customerRows = [
            ['Orbit Studios', 'Design agency', 15000, CustomerHealth::Healthy, $sana, -2, [['Daniyal Ahmed', 'Founder', 'daniyal@orbitstudios.example', '+92 321 555 0198'], ['Rida Farooq', 'Finance manager', 'rida@orbitstudios.example', null]]],
            ['Aster Pharma', 'Healthcare', 7600, CustomerHealth::Healthy, $huma, -7, [['Rabia Anwar', 'Procurement lead', 'rabia@asterpharma.example', '+92 300 555 0111']]],
            ['Meridian Textiles', 'Manufacturing', 48000, CustomerHealth::Healthy, $omar, -227, [['Kamran Ali', 'Operations Director', 'kamran@meridiantextiles.example', '+92 42 555 0102']]],
            ['Summit Logistics', 'Logistics', 31500, CustomerHealth::AtRisk, $omar, -268, [['Nida Farooq', 'COO', 'nida@summitlogistics.example', '+92 21 555 0177']]],
            ['Indus Software', 'Software', 27900, CustomerHealth::Healthy, $huma, -246, [['Asad Mehmood', 'CTO', 'asad@indussoftware.example', '+92 51 555 0133']]],
            ['Zenith Clinics', 'Healthcare', 19800, CustomerHealth::Watch, $sana, -169, [['Dr. Mehwish Ali', 'Medical Director', 'mehwish@zenithclinics.example', '+92 300 555 0155']]],
            ['Falcon Auto', 'Retail', 12400, CustomerHealth::AtRisk, $omar, -312, [['Tahir Javed', 'Owner', 'tahir@falconauto.example', '+92 333 555 0166']]],
            ['Crescent Bakery', 'Food and beverage', 6200, CustomerHealth::Healthy, $sana, -59, [['Farah Naseem', 'Founder', 'farah@crescentbakery.example', '+92 345 555 0144']]],
        ];

        $customers = [];
        foreach ($customerRows as [$name, $industry, $ltv, $health, $owner, $since, $contacts]) {
            $customer = Customer::create([
                'name' => $name,
                'industry' => $industry,
                'size' => '51–200',
                'website' => strtolower(preg_replace('/[^a-z]/i', '', $name)).'.example',
                'city' => 'Lahore',
                'health' => $health,
                'lifetime_value' => $ltv,
                'owner_id' => $owner->id,
                'customer_since' => $at($since)->toDateString(),
            ]);
            foreach ($contacts as $i => [$cName, $title, $email, $phone]) {
                $customer->contacts()->create([
                    'name' => $cName,
                    'job_title' => $title,
                    'email' => $email,
                    'phone' => $phone,
                    'is_primary' => $i === 0,
                ]);
            }
            $customers[$name] = $customer;
        }

        /* ---------------- Leads ---------------- */

        $leadRows = [
            // name, email, company, company size, source, status, owner, last activity (hours ago), title, phone
            // Scores come from LeadScorer, like any new lead's: to change a demo lead's score, change its details.
            ['Ayesha Raza', 'ayesha@cedarlogistics.example', 'Cedar Logistics', '200+', LeadSource::Referral, LeadStatus::Qualified, $huma, 2, 'Operations Director', '+92 300 555 0142'], // 95, Hot
            ['Bilal Siddiqui', 'bilal@northwind.example', 'Northwind Retail', '200+', LeadSource::Website, LeadStatus::Qualified, $omar, 5, 'Head of Digital', '+92 321 555 0187'], // 80, Hot
            ['Hira Baig', 'hira@pixelfoods.example', 'Pixel Foods', '200+', LeadSource::LinkedIn, LeadStatus::Qualified, $sana, 26, 'Head of Marketing', '+92 300 555 0123'], // 82, Hot
            ['Maryam Noor', 'maryam@brightpath.example', 'Brightpath Clinics', '51–200', LeadSource::LinkedIn, LeadStatus::Contacted, $huma, 27, 'Practice Manager', null],
            ['Hamza Qureshi', 'hamza@deltahardware.example', 'Delta Hardware', '51–200', LeadSource::Website, LeadStatus::Contacted, $omar, 48, 'Owner', null],
            ['Zainab Hussain', 'zainab@lumenfoods.example', 'Lumen Foods', '51–200', LeadSource::Event, LeadStatus::Qualified, $omar, 50, 'Brand Manager', null],
            ['Usman Tariq', 'usman@kitetravel.example', 'Kite Travel', '51–200', LeadSource::Referral, LeadStatus::New, null, 72, 'Founder', null],
            ['Sara Iqbal', 'sara@harbordental.example', 'Harbor Dental', '51–200', LeadSource::ColdEmail, LeadStatus::New, $sana, 96, 'Clinic Manager', null],
            ['Fahad Ali', 'fahad@greenleaf.example', 'Greenleaf Cafe', '51–200', LeadSource::ColdEmail, LeadStatus::Unqualified, $omar, 216, 'Manager', null],
        ];

        $leads = [];
        foreach ($leadRows as $i => [$name, $email, $company, $size, $source, $status, $owner, $hoursAgo, $title, $phone]) {
            $created = now($tz)->subDays($i === 0 ? 10 : 13 + $i)->setTime(9, 0)->utc();
            $scored = $scorer->score($source, $status, $title, $size, $phone, $email);
            $leads[$name] = Lead::create([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'job_title' => $title,
                'company' => $company,
                'company_size' => $size,
                'source' => $source,
                'status' => $status,
                'score' => $scored['score'],
                'score_factors' => $scored['factors'],
                'auto_score' => true,
                'owner_id' => $owner?->id,
                'contacted_at' => in_array($status, [LeadStatus::Contacted, LeadStatus::Qualified], true) ? $created->copy()->addDays(2) : null,
                'qualified_at' => $status === LeadStatus::Qualified ? ($i === 0 ? $at(-2, 14) : $created->copy()->addDays(5)) : null,
                'last_activity_at' => now()->subHours($hoursAgo),
                'created_at' => $created,
                'updated_at' => now()->subHours($hoursAgo),
            ]);
        }

        // Two leads that already became customers, linked both ways, with their stage dates in order.
        $convertedRows = [
            // name, email, company (the customer), company size, source, title, phone, owner, created (days ago), converted (days ago)
            ['Daniyal Ahmed', 'daniyal@orbitstudios.example', 'Orbit Studios', '1–50', LeadSource::Referral, 'Founder', '+92 321 555 0198', $sana, 20, 2],
            ['Rabia Anwar', 'rabia@asterpharma.example', 'Aster Pharma', '51–200', LeadSource::Event, 'Procurement lead', '+92 300 555 0111', $huma, 25, 7],
        ];
        foreach ($convertedRows as [$name, $email, $company, $size, $source, $title, $phone, $owner, $createdAgo, $convertedAgo]) {
            $created = $at(-$createdAgo, 9);
            $converted = $at(-$convertedAgo, 12);
            $scored = $scorer->score($source, LeadStatus::Converted, $title, $size, $phone, $email);
            $leads[$name] = Lead::create([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'job_title' => $title,
                'company' => $company,
                'company_size' => $size,
                'source' => $source,
                'status' => LeadStatus::Converted,
                'score' => $scored['score'],
                'score_factors' => $scored['factors'],
                'auto_score' => true,
                'owner_id' => $owner->id,
                'customer_id' => $customers[$company]->id,
                'contacted_at' => $created->copy()->addDays(2),
                'qualified_at' => $created->copy()->addDays(5),
                'converted_at' => $converted,
                'last_activity_at' => $converted,
                'created_at' => $created,
                'updated_at' => $converted,
            ]);
            $customers[$company]->update(['lead_id' => $leads[$name]->id]);
        }

        /* ---------------- Deals ---------------- */

        $dealRows = [
            // title, company, value, stage, temperature, close offset (days), owner, next step, lead, customer
            ['Website redesign', 'Lumen Foods', 4200, DealStage::New, DealTemperature::Warm, 35, $omar, 'Follow up '.$day(3), 'Zainab Hussain', null],
            ['CRM onboarding', 'Harbor Dental', 2800, DealStage::New, DealTemperature::New, 43, $sana, 'Follow up '.$day(5), 'Sara Iqbal', null],
            ['Support retainer', 'Kite Travel', 3500, DealStage::New, DealTemperature::New, 50, $huma, 'Follow up '.$day(6), 'Usman Tariq', null],
            ['Clinic booking portal', 'Brightpath Clinics', 5400, DealStage::Contacted, DealTemperature::Warm, 27, $huma, 'Call '.$day(2), 'Maryam Noor', null],
            ['Inventory dashboard', 'Delta Hardware', 6100, DealStage::Contacted, DealTemperature::Warm, -2, $omar, 'Call '.$day(1), 'Hamza Qureshi', null],
            ['Retail analytics suite', 'Northwind Retail', 8900, DealStage::Qualified, DealTemperature::Hot, 15, $omar, 'Demo '.$day(4), 'Bilal Siddiqui', null],
            ['Mobile app MVP', 'Pixel Foods', 11000, DealStage::Qualified, DealTemperature::Warm, -6, $sana, 'Demo '.$day(2), 'Hira Baig', null],
            ['Fleet tracking portal', 'Cedar Logistics', 12500, DealStage::Proposal, DealTemperature::Hot, 13, $huma, 'Send today', 'Ayesha Raza', null],
            ['Booking engine', 'Kite Travel', 9300, DealStage::Proposal, DealTemperature::Warm, 18, $sana, 'Review '.$day(5), null, null],
            ['Social media retainer', 'Orbit Studios', 6200, DealStage::Proposal, DealTemperature::Warm, 19, $sana, 'Send proposal tomorrow', null, 'Orbit Studios'],
            ['Brand video package', 'Orbit Studios', 15000, DealStage::Won, DealTemperature::Hot, -2, $sana, 'Customer created', null, 'Orbit Studios'],
            ['Lab booking system', 'Aster Pharma', 7600, DealStage::Won, DealTemperature::Warm, -7, $huma, 'Customer created', null, 'Aster Pharma'],
            ['Ecommerce rebuild', 'Mint Apparel', 4000, DealStage::Lost, DealTemperature::Cold, -8, $huma, 'Revisit next quarter', null, null],
        ];

        $deals = [];
        foreach ($dealRows as [$title, $company, $value, $stage, $temp, $closeIn, $owner, $next, $leadName, $customerName]) {
            $closed = $stage->isOpen() ? null : $at($closeIn, 12);
            $deals[$title] = Deal::create([
                'title' => $title,
                'company' => $company,
                'value' => $value,
                'stage' => $stage,
                'probability' => $stage->probability(),
                'temperature' => $temp,
                'expected_close_date' => $at($closeIn)->toDateString(),
                'next_step' => $next,
                'owner_id' => $owner->id,
                'lead_id' => $leadName ? $leads[$leadName]->id : null,
                'customer_id' => $customerName ? $customers[$customerName]->id : null,
                'lost_reason' => $stage === DealStage::Lost ? 'Budget' : null,
                'closed_at' => $closed,
                'created_at' => now()->subDays(20),
            ]);
        }

        /*
         * Earlier won deals that make up the older customers' lifetime value, spread over
         * the past year so the revenue charts on the dashboard and reports have real history.
         * Each customer's deals add up to the lifetime value set above.
         */
        $history = [
            // customer, title, value, closed (days ago), owner
            ['Falcon Auto', 'Showroom website', 8000, 312, $omar],
            ['Summit Logistics', 'Shipment tracker', 18000, 268, $omar],
            ['Indus Software', 'Sales CRM setup', 15900, 246, $huma],
            ['Meridian Textiles', 'ERP integration', 22000, 227, $omar],
            ['Meridian Textiles', 'Inventory module', 14000, 180, $omar],
            ['Zenith Clinics', 'Patient portal', 11800, 169, $sana],
            ['Falcon Auto', 'Service booking add-on', 4400, 150, $omar],
            ['Summit Logistics', 'Driver app', 13500, 120, $omar],
            ['Indus Software', 'Analytics add-on', 12000, 95, $huma],
            ['Zenith Clinics', 'Appointment reminders', 8000, 75, $sana],
            ['Crescent Bakery', 'Online ordering site', 6200, 59, $sana],
            ['Meridian Textiles', 'Support plan', 12000, 40, $omar],
        ];
        foreach ($history as [$customerName, $title, $value, $daysAgo, $owner]) {
            $closed = $at(-$daysAgo, 12);
            Deal::create([
                'title' => $title,
                'company' => $customerName,
                'value' => $value,
                'stage' => DealStage::Won,
                'probability' => DealStage::Won->probability(),
                'temperature' => DealTemperature::Warm,
                'expected_close_date' => $closed->toDateString(),
                'next_step' => 'Delivered',
                'owner_id' => $owner->id,
                'customer_id' => $customers[$customerName]->id,
                'closed_at' => $closed,
                'created_at' => $closed->copy()->subDays(30),
            ]);
        }

        /* ---------------- Tasks and follow-ups ---------------- */

        $taskRows = [
            // title, type, priority, due, owner, lead, customer, deal, done
            ['Send proposal to Cedar Logistics', TaskType::Email, TaskPriority::Urgent, $at(0, 17), $huma, 'Ayesha Raza', null, 'Fleet tracking portal', false],
            ['Follow-up call with Northwind', TaskType::Call, TaskPriority::High, $at(0, 15, 30), $omar, 'Bilal Siddiqui', null, null, false],
            ['Prepare demo for Brightpath', TaskType::Meeting, TaskPriority::High, $at(0, 19), $huma, 'Maryam Noor', null, null, false],
            ['Update contact details for Orbit', TaskType::Todo, TaskPriority::Low, $at(0, 18), $sana, null, 'Orbit Studios', null, false],
            ['Reply to Pixel Foods pricing question', TaskType::Email, TaskPriority::High, $at(-3), $sana, 'Hira Baig', null, null, false],
            ['Schedule kickoff call', TaskType::Meeting, TaskPriority::High, $at(3, 11), $huma, 'Ayesha Raza', null, null, false],
            ['Log intro call with Hira Baig', TaskType::Call, TaskPriority::Low, $at(-2), $sana, 'Hira Baig', null, null, true],
            ['Send intro email to Kite Travel', TaskType::Email, TaskPriority::Low, $at(-3), $omar, 'Usman Tariq', null, null, true],
        ];

        foreach ($taskRows as [$title, $type, $priority, $due, $owner, $leadName, $customerName, $dealTitle, $done]) {
            $task = Task::create([
                'title' => $title,
                'type' => $type,
                'priority' => $priority,
                'due_at' => $due,
                'reminder' => Reminder::OneHour,
                'remind_by_email' => true,
                'assigned_to' => $owner->id,
                'created_by' => $huma->id,
                'lead_id' => $leadName ? $leads[$leadName]->id : null,
                'customer_id' => $customerName ? $customers[$customerName]->id : null,
                'deal_id' => $dealTitle ? $deals[$dealTitle]->id : null,
                'completed_at' => $done ? $at(-2, 16) : null,
                'created_at' => now()->subDays(4),
            ]);

            if ($title === 'Follow-up call with Northwind') {
                $task->followUps()->create(['user_id' => $omar->id, 'outcome' => 'No answer', 'note' => 'Left a voicemail.', 'rescheduled_to' => $at(-1, 12), 'created_at' => $at(-2, 11)]);
                $task->followUps()->create(['user_id' => $omar->id, 'outcome' => 'Email sent', 'note' => 'Bilal replied asking to talk today.', 'rescheduled_to' => $at(0, 15, 30), 'created_at' => $at(-1, 12)]);
            }
        }

        /* ---------------- Activities (communication history) ---------------- */

        $ayesha = $leads['Ayesha Raza'];
        $orbit = $customers['Orbit Studios'];
        $daniyal = $leads['Daniyal Ahmed'];
        $aster = $customers['Aster Pharma'];
        $rabia = $leads['Rabia Anwar'];
        $activityRows = [
            [ActivityType::Proposal, 'Proposal drafted for Fleet tracking portal', 'Attached: proposal v1', $huma, ['lead_id' => $ayesha->id, 'deal_id' => $deals['Fleet tracking portal']->id], now()->subHours(2)],
            [ActivityType::Email, 'Opened email: Fleet tracking proposal outline', 'Opened 3 times · Clicked pricing link', $huma, ['lead_id' => $ayesha->id], now()->subHours(5)],
            [ActivityType::Call, 'Call logged (18 min): confirmed budget and timeline', 'Budget approved, wants a rollout by January', $huma, ['lead_id' => $ayesha->id], $at(-1, 16)],
            [ActivityType::StatusChange, 'Status changed from Contacted to Qualified', null, $huma, ['lead_id' => $ayesha->id], $at(-2, 14)],
            [ActivityType::Created, 'Lead created from a referral', 'Referred by Sana M.', $huma, ['lead_id' => $ayesha->id], $at(-10, 9)],
            [ActivityType::Call, 'Call with Daniyal Ahmed (12 min)', 'Happy with the brand video. Interested in a monthly social retainer.', $sana, ['customer_id' => $orbit->id], now()->subMinutes(12)],
            [ActivityType::Email, 'Sent: Social media retainer proposal', 'Opened 3 times', $sana, ['customer_id' => $orbit->id, 'deal_id' => $deals['Social media retainer']->id], now()->subHours(2)],
            [ActivityType::Note, 'Rida handles invoices', 'Send all billing to rida@orbitstudios.example, not the founder.', $huma, ['customer_id' => $orbit->id], $at(-1, 13)],
            [ActivityType::Meeting, 'Kickoff meeting at Orbit office', 'Agreed timeline and deliverables for the brand video.', $sana, ['customer_id' => $orbit->id], $at(-3, 11)],
            [ActivityType::Converted, 'Became a customer', 'Deal "Brand video package" won · $15,000', $sana, ['lead_id' => $daniyal->id, 'customer_id' => $orbit->id, 'deal_id' => $deals['Brand video package']->id], $at(-2, 12)],
            [ActivityType::Call, 'Intro call with Daniyal Ahmed (20 min)', 'Needs a brand video for their relaunch. Referred by a past client.', $sana, ['lead_id' => $daniyal->id, 'customer_id' => $orbit->id], $at(-18, 11)],
            [ActivityType::Converted, 'Became a customer', 'Deal "Lab booking system" won · $7,600', $huma, ['lead_id' => $rabia->id, 'customer_id' => $aster->id, 'deal_id' => $deals['Lab booking system']->id], $at(-7, 12)],
            [ActivityType::Call, 'Call with Rabia Anwar (15 min)', 'Met at the healthcare expo. Wants online booking for their labs.', $huma, ['lead_id' => $rabia->id, 'customer_id' => $aster->id], $at(-23, 15)],
            [ActivityType::Assigned, 'Zainab Hussain assigned to Omar T.', 'By Huma K.', $huma, ['lead_id' => $leads['Zainab Hussain']->id, 'assignee_id' => $omar->id], now()->subHours(3)],
        ];

        foreach ($activityRows as [$type, $title, $body, $user, $refs, $when]) {
            Activity::create(array_merge([
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'user_id' => $user->id,
                'occurred_at' => $when,
            ], $refs));
        }

        /* ---------------- Audit log ---------------- */

        $auditRows = [
            [$sana, 'Converted', 'Orbit Studios', 'Daniyal Ahmed became a customer', now()->subMinutes(12)],
            [$omar, 'Note added', 'Northwind Retail', 'Note on Bilal Siddiqui', now()->subHour()],
            [$huma, 'Reassigned', 'Zainab Hussain', 'Owner changed to Omar T.', now()->subHours(3)],
            [$huma, 'Status changed', 'Ayesha Raza', 'Contacted to Qualified', $at(-1, 16)],
            [$huma, 'Call logged', 'Ayesha Raza', '18 min: budget and timeline confirmed', $at(-1, 15)],
            [$huma, 'Role changed', 'Omar Tariq', 'Sales rep to Manager', $at(-2, 10)],
            [null, 'Created', 'Ayesha Raza', 'Lead added from a referral by Sana M.', $at(-10, 9)],
        ];

        foreach ($auditRows as [$user, $action, $label, $details, $when]) {
            AuditLog::create([
                'user_id' => $user?->id,
                'action' => $action,
                'record_label' => $label,
                'details' => $details,
                'created_at' => $when,
            ]);
        }
    }
}
