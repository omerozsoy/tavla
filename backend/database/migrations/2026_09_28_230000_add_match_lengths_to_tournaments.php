<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuva maç uzunlukları (puan): normal turlar match_length (varsayılan 1 = tek oyun, bugüne
// kadarki davranış). Yarı final / final ayrıca seçilebilir; NULL -> normal tur uzunluğu kullanılır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'match_length')) {
                $t->unsignedTinyInteger('match_length')->default(1)->after('size');
            }
            if (! Schema::hasColumn('tournaments', 'semi_length')) {
                $t->unsignedTinyInteger('semi_length')->nullable()->after('match_length');
            }
            if (! Schema::hasColumn('tournaments', 'final_length')) {
                $t->unsignedTinyInteger('final_length')->nullable()->after('semi_length');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            foreach (['final_length', 'semi_length', 'match_length'] as $col) {
                if (Schema::hasColumn('tournaments', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
    }
};
