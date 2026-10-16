<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * To-dos and follow-ups, assigned to a user, optionally linked to a lead, customer or deal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('type', 20)->default('todo');
            $table->string('priority', 20)->default('medium');
            $table->dateTime('due_at')->index();
            $table->string('reminder', 5)->default('1h');
            $table->boolean('remind_by_email')->default(true);
            $table->foreignId('assigned_to')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamps();

            $table->index(['assigned_to', 'completed_at', 'due_at']);
        });

        // Each attempt on a task: what happened and when it was moved to.
        Schema::create('task_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('outcome', 50);
            $table->text('note')->nullable();
            $table->dateTime('rescheduled_to')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_follow_ups');
        Schema::dropIfExists('tasks');
    }
};
