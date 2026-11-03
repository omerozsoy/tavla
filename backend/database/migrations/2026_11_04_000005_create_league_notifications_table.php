<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lig bildirim defteri (§14) — idempotent + yeniden-planlanabilir hatırlatma için. Tekrar-çalıştırılabilir
 * `league:tick` komutu her dakika geçerli randevu saatine göre due hatırlatmaları hesaplar; burada satır
 * YOKSA gönderir ve kaydeder. anchor_at = hatırlatmanın hesaplandığı randevu saati -> randevu değişince
 * anchor değişir, yeni saate göre hatırlatma gönderilebilir; eski anchor satırları geçmiş kalır (mükerrer
 * gönderim yok). unique(match,kind,channel,anchor_at) kilidi mükerrer gönderimi engeller.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_notifications', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('season_id')->constrained('league_seasons')->cascadeOnDelete();
            $t->unsignedBigInteger('match_id')->nullable();
            // new_pairing | remind_24h | remind_1h | appt_proposed | appt_confirmed | rescheduled
            $t->string('kind', 24);
            $t->string('channel', 8); // site | push | email
            $t->dateTime('anchor_at')->nullable();
            $t->dateTime('sent_at')->nullable();
            $t->timestamps();
            $t->unique(['match_id', 'kind', 'channel', 'anchor_at']);
            $t->index(['season_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_notifications');
    }
};
