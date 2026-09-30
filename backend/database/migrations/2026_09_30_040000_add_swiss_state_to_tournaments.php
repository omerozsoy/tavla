<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 3 Haklı Swiss (Swiss Triple Elimination) durum deposu: katılımcı hakları/galibiyet/eleme, kura
// seed'i, algoritma sürümü, KİLİTLİ kural seti ve eşleştirme raporları. bracket (tur/maç hücreleri)
// mevcut sütunda tutulur; bu sütun yalnız Swiss'e özgü meta. Diğer turnuva tipleri NULL bırakır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'swiss_state')) {
                $t->json('swiss_state')->nullable()->after('bracket');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'swiss_state')) {
                $t->dropColumn('swiss_state');
            }
        });
    }
};
