<?php

namespace App\Http\Requests;

use App\Enums\CustomerHealth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and edit a customer (company + primary contact). */
class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $customerId = $this->route('customer')?->id;

        return [
            'name' => ['required', 'string', 'max:150', Rule::unique('customers', 'name')->ignore($customerId)->withoutTrashed()],
            'industry' => ['required', 'string', 'max:100'],
            'size' => ['nullable', 'string', 'max:20'],
            'website' => ['nullable', 'string', 'max:190', 'not_regex:/\s/'],
            'city' => ['nullable', 'string', 'max:100'],
            'health' => ['sometimes', Rule::enum(CustomerHealth::class)],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'customer_since' => ['nullable', 'date'],
            'contact.name' => ['required', 'string', 'max:120'],
            'contact.job_title' => ['nullable', 'string', 'max:120'],
            'contact.email' => ['required', 'email', 'max:190'],
            'contact.phone' => ['nullable', 'string', 'max:30', 'regex:/^[+()\d\s-]{7,20}$/'],
        ];
    }

    public function messages(): array
    {
        return ['name.unique' => 'A customer with this name already exists.'];
    }
}
