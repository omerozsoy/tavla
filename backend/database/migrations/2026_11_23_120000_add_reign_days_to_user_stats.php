<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_stats', function (Blueprint $t): void {
            // Liderlik tablosunda 1. sirada gecirilen TOPLAM gun sayisi. Gunluk `tavla:reign-tick`
            // o anki #1'in degerini 1 artirir. Taht(7)/Hanedan(30) threshold rozetleri buna bakar.
            // Ileri-donuk: gecmis gunluk 1.lik verisi olmadigi icin backfill yok.
            $t->unsignedInteger('reign_days')->default(0)->after('best_rank');
        });
    }

    public function down(): void
    {
        Schema::table('user_stats', function (Blueprint $t): void {
            $t->dropColumn('reign_days');
        });
    }
};
