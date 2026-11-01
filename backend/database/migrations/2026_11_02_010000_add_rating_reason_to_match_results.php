<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// match_results.rating_reason: maç PUANSIZ ise sebebi (bot|unrated|guest|friendly|casual). Eskiden
// yalnız rapor anında hesaplanıp API yanıtında dönüyor, SAKLANMIYORDU -> rapor etmeyen taraf (/me/
// room-result ile okuyan) spesifik sebebi göremiyordu. Artık settlement (reportRating/MatchBackstop/
// ForfeitLoss) yazınca kalıcı. Puanlı maçta NULL. Geçmiş satırlar NULL (geri-doldurma ayrı).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (! Schema::hasColumn('match_results', 'rating_reason')) {
                $t->string('rating_reason', 16)->nullable()->after('rated');
            }
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (Schema::hasColumn('match_results', 'rating_reason')) {
                $t->dropColumn('rating_reason');
            }
        });
    }
};
