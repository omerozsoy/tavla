<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Türkiye Online Tavla Ligi — BAĞIMSIZ modül. Mevcut `tournaments` tablosundan tamamen ayrıdır;
 * lig kayıtları turnuva tablolarına KARIŞMAZ (ürün direktifi §1). Ortak altyapı (rating/coin/
 * bildirim/oda) servis olarak kullanılır ama kayıtlar birleşmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_seasons', function (Blueprint $t): void {
            $t->id();
            $t->string('name')->default('Türkiye Online Tavla Ligi');
            // draft | applications | selection | league | knockout | finished | cancelled
            $t->string('status', 20)->default('draft');
            // Tek aktif sezon GARANTİSİ (§2): aktif sezonda 1, değilse null. UNIQUE -> ikinci aktif INSERT/UPDATE patlar.
            $t->unsignedTinyInteger('active_lock')->nullable()->unique();
            $t->dateTime('applications_open_at')->nullable();
            $t->dateTime('applications_close_at')->nullable();
            $t->unsignedInteger('league_match_length')->default(9);   // §4 varsayılan 9
            $t->unsignedInteger('knockout_match_length')->default(9);
            $t->unsignedTinyInteger('current_round')->default(0);
            $t->unsignedTinyInteger('rounds_total')->default(8);      // §3 lig aşaması 8 tur
            $t->json('standings_final')->nullable();  // §5 dondurulmuş nihai lig sıralaması + ölçütler + o anki rating
            $t->json('bracket')->nullable();          // §7 eleme ağacı (ön eleme -> final), match id referanslı
            $t->json('tiebreak_manual')->nullable();  // §5.5 admin eşitlik sırası { userId: order }
            $t->json('prizes')->nullable();           // §15 [{rank|group, coins, badge, desc}]
            $t->boolean('prizes_paid')->default(false);
            $t->json('config')->nullable();           // genişletme için
            $t->timestamps();
            $t->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_seasons');
    }
};
