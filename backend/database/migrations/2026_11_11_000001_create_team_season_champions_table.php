<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Takımlar Ligi SEZON şampiyonları — sezon bitince ilk 3 takım + final puanı KALICI kaydedilir
 * (sezon puanları runtime hesaplanıp yeni sezonda sıfırlandığı için geçmiş burada saklanır).
 * Idempotent dağıtım: unique(season_key, team_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_season_champions', function (Blueprint $table) {
            $table->id();
            $table->string('season_key', 24)->index(); // "2027-kis"
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rank')->default(1); // 1..3 (şampiyon = 1)
            $table->integer('points')->default(0);  // sezon sonu takım puanı
            $table->integer('diff')->default(0);     // eşleşme puanı farkı toplamı
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('played')->default(0);
            $table->string('team_name', 64)->nullable(); // o anki ad (takım sonradan kapanabilir)
            $table->timestamp('created_at')->nullable();
            $table->unique(['season_key', 'team_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_season_champions');
    }
};
