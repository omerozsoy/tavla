<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('dice_slot_spins') || Schema::hasColumn('dice_slot_spins', 'idempotency_key')) {
            return;
        }
        Schema::table('dice_slot_spins', function (Blueprint $table): void {
            $table->string('idempotency_key', 120)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('dice_slot_spins') && Schema::hasColumn('dice_slot_spins', 'idempotency_key')) {
            Schema::table('dice_slot_spins', function (Blueprint $table): void {
                $table->dropUnique(['idempotency_key']);
                $table->dropColumn('idempotency_key');
            });
        }
    }
};
