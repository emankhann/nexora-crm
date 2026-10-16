<?php

namespace App\Models;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Models\Concerns\HasOwner;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use HasOwner, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'job_title',
        'company',
        'company_size',
        'source',
        'status',
        'score',
        'score_factors',
        'auto_score',
        'owner_id',
        'customer_id',
        'notes',
        'contacted_at',
        'qualified_at',
        'converted_at',
        'last_activity_at',
    ];

    protected function casts(): array
    {
        return [
            'source' => LeadSource::class,
            'status' => LeadStatus::class,
            'score' => 'integer',
            'score_factors' => 'array',
            'auto_score' => 'boolean',
            'contacted_at' => 'datetime',
            'qualified_at' => 'datetime',
            'converted_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class)->latest('occurred_at');
    }

    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [$this->name];
        $letters = count($parts) > 1 ? mb_substr($parts[0], 0, 1).mb_substr(end($parts), 0, 1) : mb_substr($parts[0], 0, 2);

        return mb_strtoupper($letters);
    }
}
