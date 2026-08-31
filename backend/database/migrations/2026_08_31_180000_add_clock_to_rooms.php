<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sunucu-otoriter oyun saati + AFK sistemi icin oda kolonlari.
//  - time_control: secilen tempo (casual/normal/speed) -> banka ve delay bundan turer
//  - clock: sunucu-otoriter saat durumu (banka, sira sahibi, segment baslangic ts, imza)
//  - end_reason: mac bitis nedeni (TIMEOUT / AFK_TIMEOUT / NORMAL_WIN / RESIGN)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('time_control', 16)->nullable()->after('mode');
            $table->json('clock')->nullable()->after('time_control');
            $table->string('end_reason', 24)->nullable()->after('clock');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['time_control', 'clock', 'end_reason']);
        });
    }
};
