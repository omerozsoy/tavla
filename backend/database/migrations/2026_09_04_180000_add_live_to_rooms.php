<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CANLI hamle önizlemesi (cosmetic). Sıradaki oyuncunun oynadığı/geri aldığı adımlar burada
 * tutulur -> rakip adım adım animasyonla görür. OTORİTE DEĞİL (roll/move/update ayrı; bu yalnız
 * görsel). {slot, steps, turn, seq}. Nullable -> mevcut odalar etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->json('live')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('live');
        });
    }
};
