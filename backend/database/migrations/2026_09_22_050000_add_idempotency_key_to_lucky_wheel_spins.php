<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lucky_wheel_spins') || Schema::hasColumn('lucky_wheel_spins', 'idempotency_key')) {
            return;
        }
        Schema::table('lucky_wheel_spins', function (Blueprint $table): void {
            $table->string('idempotency_key', 120)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('lucky_wheel_spins') && Schema::hasColumn('lucky_wheel_spins', 'idempotency_key')) {
            Schema::table('lucky_wheel_spins', function (Blueprint $table): void {
                $table->dropUnique(['idempotency_key']);
                $table->dropColumn('idempotency_key');
            });
        }
    }
};
