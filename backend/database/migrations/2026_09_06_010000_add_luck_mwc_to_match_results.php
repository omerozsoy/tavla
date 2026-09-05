<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tavlai Luck V1 (gnubg native): maç sonrası gnubg 'analyse match' ile hesaplanan per-oyuncu
 * NATIVE luck. luck_mwc = 'Luck total (MWC)' = doğrudan yüzde (kullanıcıya "+8.4%"). luck_emg =
 * ham 'Luck total EMG'. İstemci ONNX luck (mevcut 'luck' kolonu) anlık fallback olarak KALIR.
 * Nullable -> eski/gnubg-yok kayıtlar etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('luck_mwc')->nullable();       // gnubg native: bu oyuncunun luck'ı, MWC% (display)
            $table->float('luck_emg')->nullable();        // ham EMG toplamı (ileri detay)
            $table->string('luck_method', 24)->nullable(); // ör. TAVLAI_LUCK_V1 (metodoloji sürümü)
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['luck_mwc', 'luck_emg', 'luck_method']);
        });
    }
};
