<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M2 (denetim): (room_code, user_id) üzerinde UNIQUE index — çift-Elo/çift-satır yarışını DB
 * seviyesinde kapatır. Önce mevcut çift satırları dedupe eder (en düşük id'yi tutar). room_code
 * NULL (pvb) satırlar ETKİLENMEZ (SQL unique NULL'ları ayrı sayar). Portable PHP dedupe (MySQL+SQLite).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Dedupe: (room_code, user_id) grubunda >1 satır varsa en düşük id'yi tut, diğerlerini sil.
        $dupes = DB::table('match_results')
            ->whereNotNull('room_code')
            ->select('room_code', 'user_id', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as cnt'))
            ->groupBy('room_code', 'user_id')
            ->having('cnt', '>', 1)
            ->get();
        foreach ($dupes as $d) {
            DB::table('match_results')
                ->where('room_code', $d->room_code)
                ->where('user_id', $d->user_id)
                ->where('id', '!=', $d->keep_id)
                ->delete();
        }

        Schema::table('match_results', function (Blueprint $table) {
            $table->unique(['room_code', 'user_id'], 'mr_room_user_unique');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropUnique('mr_room_user_unique');
        });
    }
};
