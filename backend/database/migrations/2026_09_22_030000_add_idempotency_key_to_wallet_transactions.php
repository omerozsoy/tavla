<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('wallet_transactions') || Schema::hasColumn('wallet_transactions', 'idempotency_key')) {
            return;
        }

        Schema::table('wallet_transactions', function (Blueprint $table): void {
            $table->string('idempotency_key', 120)->nullable()->unique()->after('transaction_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('wallet_transactions') && Schema::hasColumn('wallet_transactions', 'idempotency_key')) {
            Schema::table('wallet_transactions', function (Blueprint $table): void {
                $table->dropUnique(['idempotency_key']);
                $table->dropColumn('idempotency_key');
            });
        }
    }
};
