<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * KARİYER KÜP PR altyapısı: küp PR tek maçta anlamsız (çok az karar), ancak oyuncunun TÜM
 * maçlarındaki küp kararları toplanınca (kariyer) anlam kazanır. Bunun için maç başına küp
 * kaybı + küp karar sayısını sakla; kullanıcıda kariyer küp PR aggregate'i tut.
 */
return new class extends Migration
{
    public function up(): void
    {
        // idempotent: kolonlar prod'da elle eklenmiş olabilir (acil uygulama) -> deploy'da patlamasın.
        Schema::table('match_results', function (Blueprint $t) {
            if (! Schema::hasColumn('match_results', 'cube_equity_lost')) {
                $t->decimal('cube_equity_lost', 10, 4)->nullable()->after('gnubg_cube_pr');
            }
            if (! Schema::hasColumn('match_results', 'cube_decisions')) {
                $t->unsignedInteger('cube_decisions')->nullable();
            }
        });
        Schema::table('users', function (Blueprint $t) {
            if (! Schema::hasColumn('users', 'career_cube_pr')) {
                $t->decimal('career_cube_pr', 7, 2)->nullable()->after('career_pr');
            }
            if (! Schema::hasColumn('users', 'career_cube_decisions')) {
                $t->unsignedInteger('career_cube_decisions')->nullable();
            }
            if (! Schema::hasColumn('users', 'career_cube_equity_lost')) {
                $t->decimal('career_cube_equity_lost', 12, 4)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            $t->dropColumn(['cube_equity_lost', 'cube_decisions']);
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn(['career_cube_pr', 'career_cube_decisions', 'career_cube_equity_lost']);
        });
    }
};
