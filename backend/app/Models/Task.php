<?php

namespace App\Models;

use App\Enums\Reminder;
use App\Enums\Role;
use App\Enums\TaskPriority;
use App\Enums\TaskType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{


    protected $fillable = [
        'title',
        'type',
        'priority',
        'due_at',
        'reminder',
        'remind_by_email',
        'reminder_sent_at',
        'assigned_to',
        'created_by',
        'lead_id',
        'customer_id',
        'deal_id',
        'notes',
        'completed_at',
    ];

    protected static function booted(): void
    {
        // Moving the due time or changing the reminder means the reminder email should go out again.
        static::saving(function (Task $task) {
            if ($task->isDirty(['due_at', 'reminder']) && ! $task->isDirty('reminder_sent_at')) {
                $task->reminder_sent_at = null;
            }
        });
    }

    protected function casts(): array
    {
        return [
            'type' => TaskType::class,
            'priority' => TaskPriority::class,
            'reminder' => Reminder::class,
            'remind_by_email' => 'boolean',
            'reminder_sent_at' => 'datetime',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** Sales reps see tasks assigned to them; admins and managers see all. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role === Role::SalesRep ? $query->where('assigned_to', $user->id) : $query;
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('completed_at');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(TaskFollowUp::class)->latest();
    }
}
