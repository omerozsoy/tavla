<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * users.featured_badges — oyuncunun profilinde/kartinda sergilemeyi sectigi en fazla 3 rozet slug'i.
 * Ornek: ["wins_gold","tourney_champion","hidden_anka"]. Sadece kazanilmis rozetler sergilenebilir
 * (dogrulama controller'da). Kart/rakip detay bileseni bu listeyi kucuk sorgu ile okur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('featured_badges')->nullable()->after('badges');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('featured_badges');
        });
    }
};
