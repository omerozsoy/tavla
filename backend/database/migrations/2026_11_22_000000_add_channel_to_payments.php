<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Ödemenin hangi kanaldan geldiği (web / android_app / iphone). Oluşturma anında Payment modelinde
// User-Agent'tan türetilir; google_play (IAP) kesin android_app. Eski kayıtlar null = bilinmiyor.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('channel', 16)->nullable()->index();
        });

        // Geçmiş IAP (Play Billing) ödemeleri kesinlikle Android uygulaması.
        DB::table('payments')->where('payment_method', 'google_play')->update(['channel' => 'android_app']);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('channel');
        });
    }
};
