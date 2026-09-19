<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SUNUCU-OTORİTER BOT MAÇI: bot (PvB) maçları artık ayrı bir istemci-tarafı motor DEĞİL,
// gerçek bir authoritative Room. p2 = sunucu-sürülen bot. Bu iki kolon bir odayı bot odası
// olarak işaretler ve zorluk seviyesini (1-10) taşır. Online (insan-insan) odalar dokunulmaz
// kalır (bot=false). Rollback güvenli: kolonlar nullable/varsayılanlı.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Bu oda bir bot maçı mı (p2 = sunucu botu). Online maçlarda false.
            $table->boolean('bot')->default(false)->index();
            // Bot zorluk seviyesi 1-10 (10 = en iyi / gürültüsüz gnubg). Online: null.
            $table->unsignedTinyInteger('bot_level')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['bot', 'bot_level']);
        });
    }
};
