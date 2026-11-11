<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * 5v5 TeamMatch sistemi SÖKÜLDÜ (kullanıcı direktifi): takım rekabeti yalnız DÜELLO puanıyla yürür.
 * Üretimde 0 maç vardı → veri kaybı yok. team_notifications KORUNUR (maç dışı bildirimler kullanabilir).
 * İleri-yönlü kaldırma; down() yeniden oluşturmaz (özellik kaldırıldı).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('team_match_games');
        Schema::dropIfExists('team_match_lineups');
        Schema::dropIfExists('team_matches');
    }

    public function down(): void
    {
        // TeamMatch özelliği kaldırıldı; geri alma yok (ileri-yönlü migration).
    }
};
