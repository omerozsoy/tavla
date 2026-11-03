<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Karşılaşma (5'e 5). Aylık sıralama bu tablodan türetilir (ayrı standing tablosu YOK → doğal arşiv).
        Schema::create('team_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('home_team_id')->index();
            $table->unsignedBigInteger('away_team_id')->index();
            $table->unsignedBigInteger('proposed_by_team_id')->nullable();
            $table->timestamp('scheduled_at')->nullable()->index();
            // proposed → scheduled (iki taraf onayladı) → live → finished | cancelled
            $table->string('status', 16)->default('proposed');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('lineup_locked_at')->nullable();
            // Takım skoru 0-5, YARIM puan dahil (çift-gelmeme eşleşmesi ½-½ → 2.5). decimal(3,1).
            $table->decimal('home_score', 3, 1)->default(0);
            $table->decimal('away_score', 3, 1)->default(0);
            // home_win | away_win | draw | double_forfeit | cancelled
            $table->string('result', 16)->nullable();
            $table->string('month_key', 7)->nullable()->index(); // YYYY-MM (planlanan başlangıç ayı, GMT+3)
            $table->unsignedBigInteger('cancel_requested_by')->nullable(); // karşılıklı iptal: ilk isteyen takım
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->string('cancel_reason', 160)->nullable();
            $table->timestamp('finished_at')->nullable(); // sonuçlanma anı (rematch 72s + aylık kesinleşme)
            $table->string('admin_note', 255)->nullable();
            $table->timestamps();
            $table->index(['home_team_id', 'status']);
            $table->index(['away_team_id', 'status']);
        });

        // Gizli kadro: kilide kadar backend/API üzerinden de rakibe açılmaz (serileştirmede gate).
        Schema::create('team_match_lineups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('match_id')->index();
            $table->unsignedBigInteger('team_id');
            $table->unsignedTinyInteger('slot'); // 1-5 (gizli sıra)
            $table->unsignedBigInteger('user_id');
            $table->timestamp('ready_at')->nullable();   // 5dk hazır-olma penceresi
            $table->boolean('premium_at_lock')->nullable();
            $table->timestamps();
            $table->unique(['match_id', 'team_id', 'slot']);
            $table->unique(['match_id', 'team_id', 'user_id']); // aynı oyuncu birden fazla yerde olamaz
        });

        // Kilitten sonra açılan beş bireysel maç (slot bazında eşleşme).
        Schema::create('team_match_games', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('match_id')->index();
            $table->unsignedTinyInteger('slot');
            $table->unsignedBigInteger('home_user_id')->nullable();
            $table->unsignedBigInteger('away_user_id')->nullable();
            $table->string('room_code', 12)->nullable()->index();
            $table->string('status', 12)->default('pending'); // pending | live | finished
            // home | away (galip) | draw (iki taraf da gelmedi, ½-½). Oynanmış maç küp-maçı → beraberlik yok.
            $table->string('result', 16)->nullable();
            $table->unsignedBigInteger('winner_user_id')->nullable();
            $table->timestamp('ready_home_at')->nullable(); // 5dk hazır-olma ısı-vuruşu (ev oyuncusu)
            $table->timestamp('ready_away_at')->nullable();
            $table->timestamp('started_at')->nullable();     // oda açıldı = GERÇEK oynandı (rating etkiler)
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->unique(['match_id', 'slot']);
        });

        // Bildirim defteri (idempotent + tekrar-çalıştırılabilir) — league_notifications ile aynı desen.
        Schema::create('team_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('match_id')->nullable()->index();
            $table->string('kind', 32);
            $table->string('channel', 8);     // site | push | email
            $table->timestamp('anchor_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->unique(['match_id', 'kind', 'channel', 'anchor_at'], 'team_notif_dedup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_notifications');
        Schema::dropIfExists('team_match_games');
        Schema::dropIfExists('team_match_lineups');
        Schema::dropIfExists('team_matches');
    }
};
