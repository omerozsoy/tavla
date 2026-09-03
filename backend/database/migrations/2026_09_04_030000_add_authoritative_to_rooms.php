<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sunucu-otoriter mod bayrağı (para maçı güvenliği Faz 2c).
 * true ise: istemci zar/hamleyi SUNUCUDAN alır (roll/move + server_state), tüm-state PUT etmez.
 * false (varsayılan): eski (legacy) akış — hiçbir mevcut maç etkilenmez. Kademeli açılır.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('authoritative')->default(false)->after('server_winner');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('authoritative');
        });
    }
};
