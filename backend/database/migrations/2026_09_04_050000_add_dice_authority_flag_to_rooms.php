<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BAĞIMSIZ Faz 1 (para maçı güvenliği): sunucu-otoriter ZAR — hamle/tahta LEGACY kalır.
 *
 * - dice_authority: bu odada zar SUNUCUDAN alınır (serverRoll) ve update() gelen state'in
 *   zarını sunucunun verdiğiyle eşleşmeye ZORLAR. Küp/hamle/tahta legacy (Node validator yok).
 *   `authoritative`den AYRIDIR (o tam otoriter Faz 2c yolu; bu yalnız zarı sunucuya alır).
 * - dice_consumed: TÜKETİLEN el sayacı (tur rengi değişince artar). dice_roll_index=VERİLEN.
 *   issued - consumed ∈ {0,1}: aynı anda tek açık el -> zar peek-ahead engeli.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('dice_authority')->default(false)->after('authoritative');
            $table->unsignedInteger('dice_consumed')->default(0)->after('dice_roll_index');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['dice_authority', 'dice_consumed']);
        });
    }
};
