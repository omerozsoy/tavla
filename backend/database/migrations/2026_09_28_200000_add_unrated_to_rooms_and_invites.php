<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// "Arkadaşınla Oyna"da PUANSIZ maç seçeneği: işaretlenirse maç rating kazandırmaz/kaybettirmez
// ve PR'ı genel (kariyer) PR / PR sıralamasına işlenmez; PR yine hesaplanır, maç analizinde görünür.
//  - rooms.unrated: odanın kendi bayrağı (RatingPolicy::isRanked bunu okur, rövanş taşır).
//  - game_invites.unrated: davetle kurulan odada enter() bayrağı davetten alır + davetli kartında görür.
// Varsayılan FALSE -> mevcut odalar/davetler davranışını korur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $t) {
            if (! Schema::hasColumn('rooms', 'unrated')) {
                $t->boolean('unrated')->default(false)->after('mode');
            }
        });
        Schema::table('game_invites', function (Blueprint $t) {
            if (! Schema::hasColumn('game_invites', 'unrated')) {
                $t->boolean('unrated')->default(false)->after('time_control');
            }
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $t) {
            if (Schema::hasColumn('rooms', 'unrated')) {
                $t->dropColumn('unrated');
            }
        });
        Schema::table('game_invites', function (Blueprint $t) {
            if (Schema::hasColumn('game_invites', 'unrated')) {
                $t->dropColumn('unrated');
            }
        });
    }
};
