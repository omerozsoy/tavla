<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_invites', function (Blueprint $table) {
            // Davet/play maci da yuzde bahisli (bakiyenin %'si: 10/30/50/100). enter() p2 katiliminda
            // odaya tasinir + pct_stake_snapshot uretilir (matchmaking ile ayni). 0 = eski potsuz davet.
            $table->unsignedTinyInteger('bet_pct')->default(0)->after('classic');
        });
    }

    public function down(): void
    {
        Schema::table('game_invites', function (Blueprint $table) {
            $table->dropColumn('bet_pct');
        });
    }
};
