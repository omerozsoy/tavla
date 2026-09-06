<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * REZERVASYON ESCROW (bahisli maç coin güvenliği). Bahisli maç başında oyuncunun stake'i coins'ten
 * DÜŞMEZ, users.coins_reserved'a REZERVE edilir. Kullanılabilir bakiye = coins - coins_reserved.
 * Tüm harcama yolları (yeni bahis, mağaza, turnuva) kullanılabilir bakiyeye bakar -> kaybeden
 * maç sırasında stake'i başka yere harcayamaz -> settle her zaman TAM stake öder. Abort'ta yalnız
 * rezerv bırakılır (coins hiç düşmediği için coin ASLA kaybolmaz). rooms.escrowed = rezerv yapıldı mı
 * (idempotent bırakma anahtarı).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('coins_reserved')->default(0)->after('coins');
        });
        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('escrowed')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('coins_reserved');
        });
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('escrowed');
        });
    }
};
