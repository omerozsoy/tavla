<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sunucu-otoriter oyun durumu (para maçı güvenliği Faz 2b).
 * - server_state: OTORİTER tahta (points/bar/off/turn/dice/diceUsed). İstemci POST etmez;
 *   yalnız /roll (zar) ve /move (doğrulanmış hamle) günceller.
 * - server_version: her otoriter değişiklikte artar (istemci senkron/çakışma için).
 * - server_winner: bir oyun bitince (off==15) kazanan renk ('white'/'black'), yoksa null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->json('server_state')->nullable()->after('dice_rolls');
            $table->unsignedInteger('server_version')->default(0)->after('server_state');
            $table->string('server_winner', 8)->nullable()->after('server_version');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['server_state', 'server_version', 'server_winner']);
        });
    }
};
