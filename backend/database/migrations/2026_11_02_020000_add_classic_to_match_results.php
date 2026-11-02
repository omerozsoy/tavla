<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// match_results.classic: bu maç KLASIK TAVLA mı (küp yok + mars=2). Eskiden klasik bilgisi YALNIZ
// rooms.classic'te duruyordu -> oda purge edilince kaybolup admin panelinde klasik/modern ayrımı
// yapılamıyordu (klasikte PR analizi atlandığı için pr=NULL kalır, ayrıca "Terk/Yedek" sanılırdı).
// Artık settlement (reportRating/MatchBackstop/ForfeitLoss) yazınca satıra sabitlenir. Geçmiş
// satırlar: odası hâlâ duruyorsa aşağıda geri-doldurulur; oda gittiyse false kalır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (! Schema::hasColumn('match_results', 'classic')) {
                $t->boolean('classic')->default(false)->after('match_type');
            }
        });

        // Geri-doldurma: odası hâlâ mevcut klasik maçları işaretle (purge edilenler false kalır).
        if (Schema::hasColumn('match_results', 'classic') && Schema::hasColumn('rooms', 'classic')) {
            DB::table('match_results')
                ->whereIn('room_code', fn ($q) => $q->select('code')->from('rooms')->where('classic', true))
                ->update(['classic' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (Schema::hasColumn('match_results', 'classic')) {
                $t->dropColumn('classic');
            }
        });
    }
};
