<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GNU-only shadow PR: gnubg orkestratörünün hesapladığı PR'ı ayrı kolonlarda saklar (client/validator
 * PR'ına DOKUNMADAN). Böylece gnubg vs client PR'ı maç-maç karşılaştırılabilir (shadow doğrulama) ve
 * ileride authoritative'e geçiş kolay olur. Nullable -> eski/analiz-yok kayıtlar etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('gnubg_pr')->nullable();          // genel (havuzlanmış checker+cube)
            $table->float('gnubg_checker_pr')->nullable();
            $table->float('gnubg_cube_pr')->nullable();
            $table->timestamp('gnubg_pr_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['gnubg_pr', 'gnubg_checker_pr', 'gnubg_cube_pr', 'gnubg_pr_at']);
        });
    }
};
