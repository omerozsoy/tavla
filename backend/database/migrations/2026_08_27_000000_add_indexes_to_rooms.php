<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// rooms tablosu buyudukce matchmaking/liveMatches/myActiveRooms/cleanupStale
// sorgulari full table scan yapiyordu. Sik filtrelenen kolonlara index eklenir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // matchmaking: status + stake + bet_pct + p1_token filtreleri
            $table->index(['status', 'stake', 'bet_pct'], 'rooms_mm_idx');
            // liveMatches/myActiveRooms/cleanupStale: status + updated_at
            $table->index(['status', 'updated_at'], 'rooms_status_updated_idx');
            // myActiveRooms: kullaniciya gore devam eden odalar
            $table->index('p1_user_id', 'rooms_p1_user_idx');
            $table->index('p2_user_id', 'rooms_p2_user_idx');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropIndex('rooms_mm_idx');
            $table->dropIndex('rooms_status_updated_idx');
            $table->dropIndex('rooms_p1_user_idx');
            $table->dropIndex('rooms_p2_user_idx');
        });
    }
};
