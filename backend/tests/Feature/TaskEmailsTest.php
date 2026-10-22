<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use App\Notifications\OverdueTasksSummary;
use App\Notifications\TaskAssigned;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * "Email the assignee" on the task form, and the daily overdue-tasks summary.
 * Notifications are faked, so nothing is sent.
 */
class TaskEmailsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    private function taskInput(array $overrides = []): array
    {
        return [
            'title' => 'Send the proposal', 'type' => 'email', 'priority' => 'high', 'reminder' => '1h', 'remind_by_email' => true,
            'due_at' => now()->addDay()->toIso8601String(), ...$overrides,
        ];
    }

    /* ----------------------------- Task assigned ----------------------------- */

    public function test_creating_a_task_for_someone_else_with_notify_emails_them_once(): void
    {
        Notification::fake();
        $omar = $this->user('omar@nexora.example');

        $id = $this->actingAs($this->user('huma@nexora.example'))
            ->postJson('/api/tasks', $this->taskInput(['assigned_to' => $omar->id, 'notify' => true]))
            ->assertCreated()->json('data.id');

        Notification::assertSentToTimes($omar, TaskAssigned::class, 1);
        Notification::assertSentTo($omar, TaskAssigned::class, function (TaskAssigned $n) use ($omar, $id) {
            $mail = $n->toMail($omar);

            return (string) $n->task->id === (string) $id
                && $mail->subject === 'New task: Send the proposal'
                && $mail->actionUrl === config('app.frontend_url')."/tasks?open={$id}";
        });
        $this->assertArrayNotHasKey('notify', Task::findOrFail($id)->getAttributes());
    }

    public function test_notify_false_or_assigning_to_yourself_sends_nothing(): void
    {
        Notification::fake();
        $huma = $this->user('huma@nexora.example');

        $this->actingAs($huma)->postJson('/api/tasks', $this->taskInput(['assigned_to' => $this->user('omar@nexora.example')->id, 'notify' => false]))->assertCreated();
        $this->actingAs($huma)->postJson('/api/tasks', $this->taskInput(['assigned_to' => $huma->id, 'notify' => true]))->assertCreated();
        $this->actingAs($huma)->postJson('/api/tasks', $this->taskInput(['notify' => true]))->assertCreated(); // defaults to yourself

        Notification::assertNothingSent();
    }

    public function test_editing_emails_only_when_the_assignee_changes(): void
    {
        Notification::fake();
        $huma = $this->user('huma@nexora.example');
        $omar = $this->user('omar@nexora.example');
        $sana = $this->user('sana@nexora.example');
        $id = $this->actingAs($huma)->postJson('/api/tasks', $this->taskInput(['assigned_to' => $omar->id, 'notify' => false]))->json('data.id');

        // Same assignee, other changes: no email.
        $this->actingAs($huma)->putJson("/api/tasks/{$id}", $this->taskInput(['title' => 'Send the new proposal', 'assigned_to' => $omar->id, 'notify' => true]))->assertOk();
        Notification::assertNothingSent();

        // A new assignee: they get the email; the previous one doesn't.
        $this->actingAs($huma)->putJson("/api/tasks/{$id}", $this->taskInput(['title' => 'Send the new proposal', 'assigned_to' => $sana->id, 'notify' => true]))->assertOk();
        Notification::assertSentToTimes($sana, TaskAssigned::class, 1);
        Notification::assertNotSentTo($omar, TaskAssigned::class);
    }

    /* ---------------------------- Overdue summary ---------------------------- */

    public function test_the_overdue_summary_lists_only_open_overdue_tasks_with_email_reminders_on(): void
    {
        Notification::fake();
        $sana = $this->user('sana@nexora.example');
        Task::query()->delete(); // only the tasks below
        $make = fn (string $title, array $extra) => Task::create([
            'title' => $title, 'type' => 'call', 'priority' => 'high', 'reminder' => '1h', 'remind_by_email' => true,
            'due_at' => now()->subDay(), 'assigned_to' => $sana->id, 'created_by' => $sana->id, ...$extra,
        ]);
        $listed = $make('Overdue, email on', []);
        $make('Overdue, email off', ['remind_by_email' => false]);
        $make('Overdue, no reminder', ['reminder' => 'none']);
        $make('Overdue but done', ['completed_at' => now()]);
        $make('Not due yet', ['due_at' => now()->addHour()]);

        $this->artisan('nexora:send-overdue-summaries')->expectsOutputToContain('Sent 1 overdue summary')->assertSuccessful();

        Notification::assertSentToTimes($sana, OverdueTasksSummary::class, 1);
        Notification::assertSentTo($sana, OverdueTasksSummary::class, function (OverdueTasksSummary $n) use ($sana, $listed) {
            $mail = $n->toMail($sana);

            return $n->tasks->pluck('id')->all() === [$listed->id]
                && $mail->subject === 'Overdue task: Overdue, email on'
                && str_contains(implode("\n", $mail->introLines), '1 day late');
        });
        Notification::assertCount(1); // nobody else has qualifying overdue tasks
    }

    public function test_the_overdue_summary_goes_out_once_a_day(): void
    {
        Notification::fake();
        $sana = $this->user('sana@nexora.example');
        Task::query()->delete();
        Task::create([
            'title' => 'Late call', 'type' => 'call', 'priority' => 'high', 'reminder' => '15m', 'remind_by_email' => true,
            'due_at' => now()->subHours(3), 'assigned_to' => $sana->id, 'created_by' => $sana->id,
        ]);

        $this->artisan('nexora:send-overdue-summaries')->assertSuccessful();
        $this->artisan('nexora:send-overdue-summaries')->expectsOutputToContain('already sent today')->assertSuccessful();
        Notification::assertSentToTimes($sana, OverdueTasksSummary::class, 1);

        $this->travel(1)->days();
        $this->artisan('nexora:send-overdue-summaries')->assertSuccessful();
        Notification::assertSentToTimes($sana, OverdueTasksSummary::class, 2);
    }

    public function test_the_overdue_summary_is_scheduled_at_9am_local_time(): void
    {
        $event = collect(app(Schedule::class)->events())->first(fn ($e) => str_contains($e->command ?? '', 'nexora:send-overdue-summaries'));

        $this->assertNotNull($event);
        $this->assertSame('0 9 * * *', $event->expression);
        $this->assertSame(config('app.local_timezone'), $event->timezone);
    }
}
