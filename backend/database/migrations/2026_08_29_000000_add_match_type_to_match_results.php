<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Median "Medyan Hata Orani" kartinda "Jeton" (coin) kategorisini 1-puanlik
// maclardan (1S) ayirabilmek icin oyun turu ayirt edicisi. match_results'ta
// coin/match ayrimi yoktu; coin tek-oyun da match_length=1 gonderiyordu.
//   'coin'  = Jeton/tek-oyun coin bahsi (stake > 0)
//   'match' = N-puanlik mac (1/3/5/7...)
// Eski satirlar geriye donuk siniflandirilamaz -> guvenli varsayilan 'match'.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->string('match_type', 16)->default('match')->after('match_length');
            // G/M (galibiyet/maglubiyet) sayimi: WHERE user_id=? AND won=?
            $table->index(['user_id', 'won'], 'mr_user_won_idx');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropIndex('mr_user_won_idx');
            $table->dropColumn('match_type');
        });
    }
};
