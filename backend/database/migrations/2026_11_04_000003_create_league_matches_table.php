<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lig/eleme eşleşmesi. Her eşleşme KENDİ oyun odasına (room_code) güvenilir biçimde bağlanır (§4/§9).
 * Oda sonucu otoriter server_match'ten okunur; rastgele masa maçları buraya YAZILMAZ (yalnız bu
 * modülün açtığı room_code eşleşmeye bağlanır).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_matches', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('season_id')->constrained('league_seasons')->cascadeOnDelete();
            $t->string('phase', 12);                       // league | prelim | r16 | qf | sf | final
            $t->unsignedTinyInteger('round');              // lig 1..8; eleme sıralı sahne no (9=prelim..13=final)
            $t->unsignedSmallInteger('bracket_pos')->default(0); // tur içi / ağaçta konum
            $t->unsignedBigInteger('p1_user_id')->nullable();
            $t->unsignedBigInteger('p2_user_id')->nullable();    // null = bay veya henüz belirsiz eleme yuvası
            $t->unsignedBigInteger('p1_from_match_id')->nullable(); // eleme besleyici ("X kazananı")
            $t->unsignedBigInteger('p2_from_match_id')->nullable();
            $t->boolean('bye')->default(false);
            $t->unsignedBigInteger('winner_user_id')->nullable();
            // pending | played | p1_forfeit | p2_forfeit | double_noshow | bye
            $t->string('result', 16)->default('pending');
            $t->string('room_code', 8)->nullable();
            $t->unsignedInteger('target')->default(9);
            $t->dateTime('mandatory_at')->nullable();      // §8 zorunlu başlangıç saati
            $t->dateTime('deadline_at')->nullable();       // §8 son oynanma (ertelenebilir)
            $t->json('appointment')->nullable();           // §8 {at, proposed_by, confirmed, history:[{by,at,action,ts}]}
            $t->dateTime('ready_p1_at')->nullable();       // §9 "Hazırım" (odada bulunma mevcut altyapıyla doğrulanır)
            $t->dateTime('ready_p2_at')->nullable();
            $t->boolean('rating_applied')->default(false); // §12 oynanmış maç rating'e YALNIZ bir kez işlenir
            $t->text('admin_note')->nullable();            // §13 sonuç düzeltme gerekçesi
            $t->timestamps();
            $t->unique(['season_id', 'phase', 'round', 'bracket_pos']); // aynı yuva iki kez oluşmaz (§11)
            $t->index(['season_id', 'round']);
            $t->index('room_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_matches');
    }
};
