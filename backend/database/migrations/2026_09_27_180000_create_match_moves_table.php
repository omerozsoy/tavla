<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SUNUCU-OTORİTER HAMLE GEÇMİŞİ (match_moves).
 *
 * KÖK NEDEN (2026-09-27): .mat / luck / PR İSTEMCİ loglarından (match_results.log = client matchLog)
 * üretiliyordu. İstemci reload/disconnect/mobil-arka-plan ile kendi logunu kaybedince rakibin
 * hamleleri eksik kalıyor -> .mat'te boş sütun, "olmayan hamle", yarım oyun, sonuçsuz maç.
 *
 * ÇÖZÜM: Sunucu ZATEN her hamleyi doğruluyor (MoveValidatorService) ve tahtayı otoriter tutuyor.
 * Her doğrulanan hamle/küp/oyun-sonu BURAYA (append-only) yazılır -> .mat/luck/PR bu TEK GERÇEK
 * kaynaktan kurulur; istemci loguna bir daha bağımlı olunmaz. Her satır TEK bir oyun eylemi:
 *   kind=move  -> steps + pos(öncesi tahta) + dice + notation
 *   kind=double/take/drop -> küp eylemi (cube_value o anki değer)
 *   kind=end   -> oyun sonucu (winner + points); applyGameResult'ta merkezî (bear-off/drop/resign/timeout hepsi)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_moves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->index();
            $table->string('room_code', 20)->index();
            $table->unsignedSmallInteger('game_no')->default(1); // oyun no (server_match.gameNo)
            $table->unsignedSmallInteger('seq')->default(0);      // turnsPlayed (server_match.turns)
            $table->smallInteger('ord')->default(0);              // aynı seq içinde sıra: double=-3<take/drop=-2<move=0<end=9
            $table->string('player', 5);                          // white | black
            $table->string('kind', 8);                            // move | double | take | drop | end
            $table->json('dice')->nullable();                     // [d1,d2] (çiftte 4)
            $table->json('steps')->nullable();                    // [{from,to,die}] iç indeks (0-23) / bar / off
            $table->string('notation', 80)->nullable();           // "bar/23 21/15" (oyuncu perspektifi)
            $table->json('pos')->nullable();                      // hamle ÖNCESİ tahta (points/bar/off/turn/dice)
            $table->json('mctx')->nullable();                     // {score,cube,cubeOwner,crawford,matchLen} — PR match-aware eval
            $table->unsignedSmallInteger('cube_value')->default(1); // eylem anındaki küp değeri
            $table->unsignedSmallInteger('points')->nullable();   // kind=end: oyun puanı (cube×gammon)
            $table->string('winner', 5)->nullable();              // kind=end: kazanan renk
            $table->timestamp('created_at')->nullable();

            // Kanonik sıralama: oyun -> tur -> aynı-tur-ord -> ekleme sırası (id).
            $table->index(['room_code', 'game_no', 'seq', 'ord', 'id'], 'mm_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_moves');
    }
};
