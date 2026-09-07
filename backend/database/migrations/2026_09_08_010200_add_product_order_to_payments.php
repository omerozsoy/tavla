<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// kind='product' odemelerinde hangi siparisin fulfill edilecegini baglar.
// Callback/demo basariliysa bu siparis 'paid' yapilir + stok dusulur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedBigInteger('product_order_id')->nullable()->after('package_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('product_order_id');
        });
    }
};
