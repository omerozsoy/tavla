<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PR ÇÖP-KALKANI backfill imleci. tavla:pr-from-review --resume bu damgayı kullanır:
 * yalnız pr_shield_at IS NULL satırlar işlenir, her satır işlenince now() damgalanır ->
 * on binlerce review'li maç OOM/kesinti olsa da KALDIĞI YERDEN devam eder (baştan hesap yok).
 * İlerleme: SELECT COUNT(*) WHERE gnubg_review IS NOT NULL AND pr_shield_at IS NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->timestamp('pr_shield_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('pr_shield_at');
        });
    }
};
