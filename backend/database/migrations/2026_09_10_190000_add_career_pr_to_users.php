<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Career PR (PR Sıralaması) icin oyuncu-bazli HAVUZLANMIS aggregate cache. Career PR maç
// PR'larinin ortalamasi DEGILDIR; ham havuzlama: career_pr = (Σ pr_equity_lost / Σ pr_decisions)×500
// (match_results.pr ile AYNI matematik). Bu kolonlar CareerPrService ile guncellenir/yeniden kurulur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->float('career_pr')->nullable();                     // havuzlanmis PR (dusuk=iyi); null=veri yok
            $table->unsignedInteger('career_pr_matches')->default(0);    // hesaba dahil analiz edilmis mac
            $table->unsignedInteger('career_pr_decisions')->default(0);  // hesaba dahil sayilan karar
            $table->float('career_pr_equity_lost')->default(0);          // Σ prAdjusted equity kaybi (hassasiyet/rebuild)
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['career_pr', 'career_pr_matches', 'career_pr_decisions', 'career_pr_equity_lost']);
        });
    }
};
