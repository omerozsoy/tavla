<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// KLASIK TAVLA modu: küp YOK + mars sabit 2 puan (backgammon-3 yok). Diğer tüm kurallar normal maçla
// aynıdır. İzlenen puanlama farkını sunucu Backgammon::gamePoints($classic) uygular; küp reddi
// RoomController::cubeAvailability'de. Eşleşme havuzu klasik<->klasik ayrışır (matchmaking filtresi).
//  - rooms.classic: odanın kendi bayrağı (skor + küp + rozet + rövanş bunu okur).
//  - game_invites.classic: davetle kurulan oda enter() bayrağını davetten alır + davetli kartında rozet.
// Varsayılan FALSE -> mevcut tüm odalar/davetler normal maç davranışını korur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $t) {
            if (! Schema::hasColumn('rooms', 'classic')) {
                $t->boolean('classic')->default(false)->after('unrated');
            }
        });
        Schema::table('game_invites', function (Blueprint $t) {
            if (! Schema::hasColumn('game_invites', 'classic')) {
                $t->boolean('classic')->default(false)->after('unrated');
            }
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $t) {
            if (Schema::hasColumn('rooms', 'classic')) {
                $t->dropColumn('classic');
            }
        });
        Schema::table('game_invites', function (Blueprint $t) {
            if (Schema::hasColumn('game_invites', 'classic')) {
                $t->dropColumn('classic');
            }
        });
    }
};
