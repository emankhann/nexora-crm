<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds CRM fields to Laravel's default users table:
 * role (admin / manager / sales_rep), invite status and activity tracking.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('sales_rep')->after('email')->index();
            $table->string('status', 20)->default('active')->after('role');
            $table->string('job_title')->nullable()->after('status');
            $table->timestamp('invited_at')->nullable()->after('job_title');
            $table->timestamp('last_active_at')->nullable()->after('invited_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn(['role', 'status', 'job_title', 'invited_at', 'last_active_at']);
        });
    }
};
