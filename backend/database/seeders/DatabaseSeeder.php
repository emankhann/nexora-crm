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
        // The demo accounts all use the published password "demo1234", so they must never be
        // created on a live server by accident. Set ALLOW_DEMO_SEED=true to seed a public demo.
        if (app()->isProduction() && ! env('ALLOW_DEMO_SEED', false)) {
            $this->command?->warn('Skipped the demo data: this is a production environment. Set ALLOW_DEMO_SEED=true to seed it anyway.');

            return;
        }

        $this->call([
            UserSeeder::class,
            CrmDemoSeeder::class,
        ]);
    }
}
