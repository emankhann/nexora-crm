<?php

namespace App\Http\Requests;

use App\Enums\Reminder;
use App\Enums\TaskPriority;
use App\Enums\TaskType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and edit a task. */
class TaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'type' => ['required', Rule::enum(TaskType::class)],
            'priority' => ['required', Rule::enum(TaskPriority::class)],
            'due_at' => ['required', 'date'],
            'reminder' => ['required', Rule::enum(Reminder::class)],
            'remind_by_email' => ['boolean'],
            'assigned_to' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->withoutTrashed()],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->withoutTrashed()],
            'deal_id' => ['nullable', 'integer', Rule::exists('deals', 'id')->withoutTrashed()],
            'notes' => ['nullable', 'string', 'max:2000'],
            // "Email the assignee": not saved on the task, only decides whether TaskAssigned is sent.
            'notify' => ['boolean'],
        ];
    }
}
