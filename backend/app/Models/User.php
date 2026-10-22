<?php

namespace App\Models;

use App\Enums\Role;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'job_title',
        'invited_at',
        'last_active_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'invited_at' => 'datetime',
            'last_active_at' => 'datetime',
            'overdue_summary_sent_on' => 'date',
            'password' => 'hashed',
            'role' => Role::class,
            'status' => UserStatus::class,
        ];
    }

    /** "Huma Khan" → "Huma K." (how owners are shown in lists). */
    public function shortName(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [$this->name];

        return count($parts) > 1 ? $parts[0].' '.mb_substr(end($parts), 0, 1).'.' : $parts[0];
    }

    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [$this->name];
        $letters = count($parts) > 1 ? mb_substr($parts[0], 0, 1).mb_substr(end($parts), 0, 1) : mb_substr($parts[0], 0, 2);

        return mb_strtoupper($letters);
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'owner_id');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class, 'owner_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assigned_to');
    }
}
