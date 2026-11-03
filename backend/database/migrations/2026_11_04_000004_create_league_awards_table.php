<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lig ödül dağıtım defteri (§15). unique(season,user,award_key) => aynı ödül aynı kullanıcıya aynı
 * sezonda yalnız BİR kez verilir; görev tekrar çalışsa/yarıda kalıp devam etse de mükerrer coin/rozet
 * oluşmaz. Satır VARSA ödül dağıtılmış demektir (idempotent kanıt).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_awards', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('season_id')->constrained('league_seasons')->cascadeOnDelete();
            $t->unsignedBigInteger('user_id');
            $t->string('award_key', 40);           // champion | runner_up | semifinal | ... | rank_1
            $t->unsignedBigInteger('coins')->default(0);
            $t->string('badge', 40)->nullable();
            $t->string('desc', 120)->nullable();
            $t->string('error', 255)->nullable();  // §15 dağıtım hatası (panelde görünür)
            $t->timestamps();
            $t->unique(['season_id', 'user_id', 'award_key']);
            $t->index('season_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_awards');
    }
};
