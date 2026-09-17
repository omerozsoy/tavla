<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Oyun daveti artik oyun ayarlarini tasir: davet eden Tek Oyun / Mac Oyunu (kac puan)
// ve sure (saat) secer -> davet edilen NEYE davet edildigini gorur; kabulde AYNI ayarla
// odaya girer. (Eskiden davet sadece oda koduydu; davetli ayarlari bilmiyordu, target=3 sabitti.)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_invites', function (Blueprint $table) {
            $table->unsignedSmallInteger('target')->default(1)->after('room_code'); // 1 = Tek Oyun; >1 = Mac uzunlugu (puan)
            $table->string('time_control', 16)->nullable()->after('target'); // casual | normal | speed
        });
    }

    public function down(): void
    {
        Schema::table('game_invites', function (Blueprint $table) {
            $table->dropColumn(['target', 'time_control']);
        });
    }
};
