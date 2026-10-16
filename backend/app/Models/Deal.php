<?php

namespace App\Models;

use App\Enums\DealStage;
use App\Enums\DealTemperature;
use App\Models\Concerns\HasOwner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Deal extends Model
{
    use HasOwner, SoftDeletes;

    protected $fillable = [
        'title',
        'company',
        'value',
        'stage',
        'probability',
        'temperature',
        'expected_close_date',
        'next_step',
        'owner_id',
        'lead_id',
        'customer_id',
        'lost_reason',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'stage' => DealStage::class,
            'probability' => 'integer',
            'temperature' => DealTemperature::class,
            'expected_close_date' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('stage', DealStage::open());
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class)->latest('occurred_at');
    }
}
