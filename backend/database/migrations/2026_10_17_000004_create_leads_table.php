<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Potential customers. A qualified lead is converted into a customer (and optionally a deal).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 30)->nullable();
            $table->string('job_title')->nullable();
            $table->string('company');
            $table->string('company_size', 20)->nullable();
            $table->string('source', 20)->index();
            $table->string('status', 20)->default('new')->index();
            $table->unsignedTinyInteger('score')->default(0);
            // Why the lead has its score: [{label, points}, ...]
            $table->json('score_factors')->nullable();
            $table->boolean('auto_score')->default(true);
            // Null owner = unassigned.
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            // When the lead reached each stage (for the stage stepper and reports).
            $table->timestamp('contacted_at')->nullable();
            $table->timestamp('qualified_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('last_activity_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_id', 'status']);
        });

        // A customer remembers which lead it came from.
        Schema::table('customers', function (Blueprint $table) {
            $table->foreignId('lead_id')->nullable()->after('owner_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lead_id');
        });
        Schema::dropIfExists('leads');
    }
};
