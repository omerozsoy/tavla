<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cached lifetime WXP toplami. Source of truth user_wxp_transactions ledger'idir;
// bu alan yalnizca performans icin cache'lenmis toplamdir ve her zaman
// SUM(user_wxp_transactions.amount) ile yeniden uretilebilir (stats:backfill-wxp --rebuild-totals).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('total_wxp')->default(0)->after('games_played');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('total_wxp');
        });
    }
};
