<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Shopier REST API v1 (PAT): her ödeme tek-seferlik Shopier ürünü olarak oluşturulur. product_id
// webhook'ta siparişi Payment'a eşlemek için; url refresh'te aynı linke götürmek için saklanır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('shopier_product_id')->nullable()->index();
            $table->string('shopier_url', 1024)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['shopier_product_id', 'shopier_url']);
        });
    }
};
