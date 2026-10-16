<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who changed what and when. Written by App\Support\Audit, read on the Audit log page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 40)->index();
            $table->string('record_type', 40)->nullable();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('record_label');
            $table->string('details')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['record_type', 'record_id']);
        });

        // Which reminders in the bell a user has already read.
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('notice_key');
            $table->timestamp('read_at')->useCurrent();

            $table->unique(['user_id', 'notice_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
        Schema::dropIfExists('audit_logs');
    }
};
