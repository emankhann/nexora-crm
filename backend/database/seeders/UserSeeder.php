<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Demo accounts. All active accounts use the password "demo1234" (hashed by the model cast).
 */
class UserSeeder extends Seeder
{
    public const PASSWORD = 'demo1234';

    public function run(): void
    {
        $team = [
            ['name' => 'Huma Khan', 'email' => 'huma@nexora.example', 'role' => Role::Admin, 'job_title' => 'Head of Sales', 'active' => now()],
            ['name' => 'Omar Tariq', 'email' => 'omar@nexora.example', 'role' => Role::Manager, 'job_title' => 'Sales Manager', 'active' => now()->subHours(2)],
            ['name' => 'Sana Mirza', 'email' => 'sana@nexora.example', 'role' => Role::SalesRep, 'job_title' => 'Sales Executive', 'active' => now()->subDay()],
        ];

        foreach ($team as $person) {
            User::updateOrCreate(
                ['email' => $person['email']],
                [
                    'name' => $person['name'],
                    'password' => self::PASSWORD,
                    'role' => $person['role'],
                    'status' => UserStatus::Active,
                    'job_title' => $person['job_title'],
                    'last_active_at' => $person['active'],
                    'email_verified_at' => now(),
                ]
            );
        }

        // A pending invite: the account exists but can't sign in until it's accepted.
        User::updateOrCreate(
            ['email' => 'kamran@nexora.example'],
            [
                'name' => 'Kamran Shah',
                'password' => Str::random(40),
                'role' => Role::SalesRep,
                'status' => UserStatus::Pending,
                'invited_at' => now()->subDay(),
            ]
        );
    }
}
