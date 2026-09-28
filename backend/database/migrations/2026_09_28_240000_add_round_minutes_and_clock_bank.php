<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuva mac SURESI (dakika, oyuncu basina ana sure): normal turlar round_minutes; yari final /
// final ayrica girilebilir (NULL -> normal tur suresi). Hepsi NULL -> saat modunun varsayilani.
// rooms.clock_bank: odanin oyuncu basina ana suresi (sn) — verilirse MatchClock bunu kullanir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            foreach (['round_minutes', 'semi_minutes', 'final_minutes'] as $col) {
                if (! Schema::hasColumn('tournaments', $col)) {
                    $t->unsignedSmallInteger($col)->nullable();
                }
            }
        });
        Schema::table('rooms', function (Blueprint $t) {
            if (! Schema::hasColumn('rooms', 'clock_bank')) {
                $t->unsignedInteger('clock_bank')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            foreach (['round_minutes', 'semi_minutes', 'final_minutes'] as $col) {
                if (Schema::hasColumn('tournaments', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
        Schema::table('rooms', function (Blueprint $t) {
            if (Schema::hasColumn('rooms', 'clock_bank')) {
                $t->dropColumn('clock_bank');
            }
        });
    }
};
