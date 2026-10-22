<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Open deals are always counted from the real deals now, so they can all be clicked.
 * The old "open deals from before Nexora" number on customers is gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('legacy_open_deals');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->unsignedInteger('legacy_open_deals')->default(0)->after('lifetime_value');
        });
    }
};
