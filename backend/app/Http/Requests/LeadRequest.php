<?php

namespace App\Http\Requests;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and edit a lead. */
class LeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Record-level checks happen in the controller via LeadPolicy.
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => strtolower(trim((string) $this->input('email'))),
            'name' => trim((string) $this->input('name')),
            'company' => trim((string) $this->input('company')),
        ]);
    }

    public function rules(): array
    {
        $leadId = $this->route('lead')?->id;

        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('leads', 'email')->ignore($leadId)->withoutTrashed()],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[+()\d\s-]{7,20}$/'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'company' => ['required', 'string', 'max:150'],
            'company_size' => ['nullable', Rule::in(['1–50', '51–200', '200+', '1-50', '51-200'])],
            'source' => ['required', Rule::enum(LeadSource::class)],
            // "converted" is only set by the convert action, and a converted lead keeps it.
            'status' => [
                $this->route('lead')?->status === LeadStatus::Converted ? 'sometimes' : 'required',
                Rule::enum(LeadStatus::class)->except([LeadStatus::Converted]),
            ],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'A lead with this email already exists.',
            'phone.regex' => 'Use digits, spaces, + ( ) or -.',
        ];
    }
}
