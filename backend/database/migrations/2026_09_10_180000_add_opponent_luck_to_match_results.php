<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Rakibin HAM luck'ini (sans) satirin KENDISINDE sakla. Online maclarda rakibin luck'i
// karsi satirdan (room_code) okunur; ama PvB (yapay zeka) maclarinda rakip=BOT icin ayri
// satir/oda YOKTUR -> bot luck'i hicbir yerde tutulmuyordu ("AI'nin sansi gozukmuyor").
// Bu kolon tek-istemcili maclarda (pvb) rakip luck'ini dogrudan tasir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('opponent_luck')->nullable()->after('opponent_pr'); // rakibin (bot) ham luck'i
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('opponent_luck');
        });
    }
};
