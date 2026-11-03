<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lig başvuru + katılımcı kaydı (TEK tablo; status yaşam döngüsünü yürütür — ponytail: başvuru ve
 * katılımcı için ayrı iki tablo yerine durum geçişi). pending=başvuran, accepted=seçilmiş asıl oyuncu,
 * reserve=yedek, rejected=elenmiş başvuru, withdrawn=sezon içinde çekilen. unique(season,user) => §2
 * "aynı kullanıcı aynı sezona birden fazla başvuramaz".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_participants', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('season_id')->constrained('league_seasons')->cascadeOnDelete();
            $t->unsignedBigInteger('user_id');
            $t->boolean('premium_at_apply')->default(false); // §2 başvuru anındaki uygunluk kaydı (sonra düşse de hak korunur)
            $t->string('status', 16)->default('pending');    // pending|accepted|reserve|rejected|withdrawn
            $t->unsignedInteger('seed')->nullable();          // lig başında kilitlenen kura sırası (nihai tie-break)
            $t->unsignedInteger('reserve_order')->nullable(); // yedek listesi sırası
            $t->json('state')->nullable();                    // oynanış durumu (puan/rakipler/bay) — lig başında doldurulur
            $t->dateTime('withdrawn_at')->nullable();
            $t->unsignedBigInteger('decided_by')->nullable(); // seçimi yapan admin
            $t->dateTime('decided_at')->nullable();
            $t->timestamps();
            $t->unique(['season_id', 'user_id']);
            $t->index(['season_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_participants');
    }
};
