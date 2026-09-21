<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_orders', function (Blueprint $table) {
            $table->uuid('idempotency_key')->nullable()->after('payment_id');
            $table->unique(['user_id', 'idempotency_key', 'product_id'], 'product_orders_user_idempotency_unique');
        });
    }

    public function down(): void
    {
        Schema::table('product_orders', function (Blueprint $table) {
            $table->dropUnique('product_orders_user_idempotency_unique');
            $table->dropColumn('idempotency_key');
        });
    }
};
