<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * user_stats — Basarim (achievement) motorunun ihtiyac duydugu INCREMENTAL sayaclar.
 * Mevcut users tablosunda olmayan sayaclar burada tutulur ki her mac sonunda tum
 * gecmis yeniden taranmasin. Kaynak-of-truth degil, TURETILMIS hizlandirici cache:
 * backfill komutu match_results + decision_analyses'ten yeniden uretebilir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // Rating / lig
            $table->unsignedInteger('best_rating')->default(1500); // kariyer zirvesi
            $table->unsignedInteger('best_rank')->nullable();       // ulasilan en iyi (dusuk) liderlik sirasi

            // Seriler
            $table->unsignedInteger('current_win_streak')->default(0);
            $table->unsignedInteger('best_win_streak')->default(0);
            $table->unsignedInteger('current_loss_streak')->default(0);

            // Tavla/mars
            $table->unsignedInteger('total_gammons')->default(0);      // mars ile kazanma
            $table->unsignedInteger('total_backgammons')->default(0);  // katmerli mars ile kazanma

            // Zar
            $table->unsignedInteger('total_doubles')->default(0);      // oyuncunun attigi cift zar sayisi

            // Turnuva
            $table->unsignedInteger('tournaments_won')->default(0);
            $table->unsignedInteger('tournaments_played')->default(0);

            // Coin / servet (ledger yok -> ileri-dogru kumulatif; backfill coins_after farklarindan yaklasik)
            $table->unsignedBigInteger('lifetime_coin')->default(0);

            // AI analiz / yetenek
            $table->unsignedInteger('analysis_count')->default(0);         // log'lu (analiz edilmis) mac sayisi
            $table->unsignedInteger('clean_matches')->default(0);          // >=N karar + 0 blunder mac
            $table->unsignedInteger('correct_cube_decisions')->default(0); // dogru kup karari (kumulatif)
            $table->unsignedInteger('best_move_streak')->default(0);       // tek macta en uzun ardisik best-move
            $table->float('best_error_rate')->nullable();                  // ulasilan en dusuk (iyi) PR

            // Eglenceli / zaman-bazli sayaclar
            $table->unsignedInteger('night_matches')->default(0);   // 02:00-05:00 arasi oynanan mac
            $table->unsignedInteger('matches_today')->default(0);   // bugun oynanan mac (gun degisince sifirlanir)
            $table->date('matches_today_date')->nullable();

            // Sosyal / rakip-iliskisel bounded sayaclar + gizli flag durumlari.
            // Ornek: {"beat":{"ahmet":3}, "lost":{"veli":2}, "met":{"ali":11}, "flags":["seen_66"]}
            $table->json('meta')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_stats');
    }
};
