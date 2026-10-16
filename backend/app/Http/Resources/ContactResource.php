<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Contact */
class ContactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'jobTitle' => $this->job_title ?? '',
            'email' => $this->email ?? '',
            'phone' => $this->phone ?? '',
            'primary' => $this->is_primary,
        ];
    }
}
