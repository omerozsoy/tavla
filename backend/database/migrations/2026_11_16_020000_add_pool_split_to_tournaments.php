<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Yüzdeli ödül havuzu: pool_enabled=true ise oyuncuların ödediği giriş ücretleri (coin) havuzda
 * toplanır; %10 komisyon düşülür, kalan pool_pcts (1./2./3. yüzdeleri, varsayılan 60/25/15) ile
 * dağıtılır. Kapalıyken (varsayılan) eski davranış: giriş ücreti yakılır. Bkz App\Support\TournamentPool.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['tournaments', 'tournament_schedules'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) {
                $table->boolean('pool_enabled')->default(false);
                $table->json('pool_pcts')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['tournaments', 'tournament_schedules'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) {
                $table->dropColumn(['pool_enabled', 'pool_pcts']);
            });
        }
    }
};
