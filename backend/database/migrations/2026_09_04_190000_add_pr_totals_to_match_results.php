<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * XG-style PR havuzlama totalleri (§13). DOĞRU lifetime/oturum PR'ı için maç PR'larının
 * ortalaması ALINMAZ; ham (Σ equity kaybı, Σ sayılan karar) HAVUZLANIR:
 *   lifetimePR = (Σ pr_equity_lost / Σ pr_decisions) × 500
 * Bu yüzden her maçta bu iki ham toplam saklanır. Nullable -> eski kayıtlar/analiz-yok etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('pr_equity_lost')->nullable();   // sayılan kararların toplam prAdjusted equity kaybı
            $table->unsignedInteger('pr_decisions')->nullable(); // sayılan karar adedi
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['pr_equity_lost', 'pr_decisions']);
        });
    }
};
