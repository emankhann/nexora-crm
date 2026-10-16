<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Companies that have bought from us. Created by converting a lead or added directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('industry', 100);
            $table->string('size', 20)->nullable();
            $table->string('website')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('health', 20)->default('healthy')->index();
            $table->decimal('lifetime_value', 12, 2)->default(0);
            // Deals opened before the CRM existed (sample data); new deals are counted live.
            $table->unsignedInteger('legacy_open_deals')->default(0);
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('customer_since');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
