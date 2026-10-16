<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskFollowUp extends Model
{
    protected $fillable = ['task_id', 'user_id', 'outcome', 'note', 'rescheduled_to'];

    protected function casts(): array
    {
        return ['rescheduled_to' => 'datetime'];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
