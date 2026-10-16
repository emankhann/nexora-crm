<?php

namespace App\Http\Requests;

use App\Enums\DealStage;
use App\Enums\DealTemperature;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and edit a deal. Stage changes on edit go through DealStageService. */
class DealRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'company' => ['required', 'string', 'max:150'],
            'value' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'stage' => ['required', Rule::enum(DealStage::class)],
            'probability' => ['nullable', 'integer', 'between:0,100'],
            'temperature' => ['nullable', Rule::enum(DealTemperature::class)],
            'expected_close_date' => ['required', 'date'],
            'next_step' => ['nullable', 'string', 'max:255'],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->withoutTrashed()],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->withoutTrashed()],
            'lost_reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
