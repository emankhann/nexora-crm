<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opportunities moving through the sales pipeline: new → contacted → qualified → proposal → won/lost.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('company');
            $table->decimal('value', 12, 2);
            $table->string('stage', 20)->default('new')->index();
            $table->unsignedTinyInteger('probability')->default(10);
            $table->string('temperature', 10)->default('warm');
            $table->date('expected_close_date')->index();
            $table->string('next_step')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('lost_reason')->nullable();
            $table->timestamp('closed_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_id', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deals');
    }
};
