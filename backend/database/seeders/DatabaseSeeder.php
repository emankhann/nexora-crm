<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * php artisan migrate:fresh --seed
     * Creates the demo team and a realistic set of CRM records.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            CrmDemoSeeder::class,
        ]);
    }
}
