<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sunucu-otoriter zar (para maçı güvenliği Faz 1): commit-reveal alanları.
 * - dice_seed: gizli sunucu tohumu (oyun bitince/reveal'a kadar istemciye GÖNDERİLMEZ).
 * - dice_commit: SHA256(dice_seed) — istemcilere gösterilir (taahhüt).
 * - dice_client_seed: istemci katkısı (provably-fair).
 * - dice_roll_index: verilen el sayacı (idempotent replay için).
 * - dice_rolls: verilen zarların logu (doğrulama/denetim).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('dice_seed', 64)->nullable()->after('clock');
            $table->string('dice_commit', 64)->nullable()->after('dice_seed');
            $table->string('dice_client_seed', 64)->nullable()->after('dice_commit');
            $table->unsignedInteger('dice_roll_index')->default(0)->after('dice_client_seed');
            $table->json('dice_rolls')->nullable()->after('dice_roll_index');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['dice_seed', 'dice_commit', 'dice_client_seed', 'dice_roll_index', 'dice_rolls']);
        });
    }
};
