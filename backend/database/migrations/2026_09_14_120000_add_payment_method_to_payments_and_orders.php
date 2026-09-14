<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Havale/EFT odeme yontemi: odeme kaydinin nasil tahsil edilecegini isaretler.
// null => kart (Garanti 3D) veya coin (mevcut akis, geriye donuk uyum). 'bank_transfer'
// => havale; kart callback'i tetiklenmez, admin panelde elle 'paid' yapilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('payment_method', 20)->nullable()->after('kind');
        });
        Schema::table('product_orders', function (Blueprint $table) {
            $table->string('payment_method', 20)->nullable()->after('payment_type');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
        Schema::table('product_orders', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
