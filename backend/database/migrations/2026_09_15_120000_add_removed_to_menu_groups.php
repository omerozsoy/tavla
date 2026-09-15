<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * menu_groups.removed — YAPISAL (katalog) gruplar da "silinebilsin" diye tombstone.
 * Katalog grubu hard-delete edilirse syncCatalog() bir sonraki liste acilisinda geri ekler
 * ("silemedim" tuzagi). Bunun yerine removed=true isaretlenir: satir KALIR (syncCatalog
 * geri EKLEMEZ, cunku key mevcut), admin listesinden gizlenir, menu API'de gorunmez.
 * "Silinenler" filtresinden geri getirilebilir (removed=false).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_groups', function (Blueprint $table) {
            $table->boolean('removed')->default(false)->after('visible');
        });
    }

    public function down(): void
    {
        Schema::table('menu_groups', function (Blueprint $table) {
            $table->dropColumn('removed');
        });
    }
};
