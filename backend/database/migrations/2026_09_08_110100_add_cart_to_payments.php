<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sepet ödemesi (kind='cart'): tek Garanti ödemesi hem coin paketlerini (payments.coins)
// hem birden çok fiziksel ürün siparişini (product_order_ids) karşılar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->json('product_order_ids')->nullable()->after('product_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('product_order_ids');
        });
    }
};
