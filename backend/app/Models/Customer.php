<?php

namespace App\Models;

use App\Enums\CustomerHealth;
use App\Enums\DealStage;
use App\Models\Concerns\HasOwner;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasOwner, SoftDeletes;

    protected $fillable = [
        'name',
        'industry',
        'size',
        'website',
        'city',
        'health',
        'lifetime_value',
        'legacy_open_deals',
        'owner_id',
        'lead_id',
        'customer_since',
    ];

    protected function casts(): array
    {
        return [
            'health' => CustomerHealth::class,
            'lifetime_value' => 'decimal:2',
            'legacy_open_deals' => 'integer',
            'customer_since' => 'date',
        ];
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class)->orderByDesc('is_primary')->orderBy('id');
    }

    public function primaryContact(): HasOne
    {
        return $this->hasOne(Contact::class)->where('is_primary', true);
    }

    /** The lead this customer was converted from, if any. */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class);
    }

    public function openDeals(): HasMany
    {
        return $this->deals()->whereIn('stage', DealStage::open());
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class)->latest('occurred_at');
    }
}
