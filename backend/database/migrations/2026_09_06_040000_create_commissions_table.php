<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Komisyon (rake) LEDGER'ı: bahisli maç settle'ında platformun aldığı komisyon KAYDEDİLİR (kimseye
 * kredi edilmez — dolaşımdan çıkar ama raporlanabilir). Kazanan stake × (1 − oran) alır; fark komisyon.
 * Admin panelde toplam/geçmiş görülür. Oran: config('game.commission_pct') (COMMISSION_PCT env).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->string('room_code', 20)->nullable()->index();
            $table->unsignedBigInteger('winner_id')->nullable();
            $table->unsignedBigInteger('loser_id')->nullable();
            $table->unsignedBigInteger('stake');       // kaybedenin ödediği (tam)
            $table->unsignedBigInteger('commission');  // platform payı (stake − kazananın aldığı)
            $table->unsignedSmallInteger('pct');       // uygulanan oran (%), kayıt için
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commissions');
    }
};
