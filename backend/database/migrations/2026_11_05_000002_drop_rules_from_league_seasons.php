<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * §16 kuralları per-season değil TEK global ayar oldu (Setting 'league_rules'). Kısa süre önce
 * eklenen per-season `rules` kolonu (hiç veri yazılmadı) kaldırılır.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('league_seasons', 'rules')) {
            Schema::table('league_seasons', function (Blueprint $t): void {
                $t->dropColumn('rules');
            });
        }
    }

    public function down(): void
    {
        Schema::table('league_seasons', function (Blueprint $t): void {
            $t->text('rules')->nullable()->after('prizes');
        });
    }
};
