<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Soru Maratonu: anonim skor tabelası. user'a BAĞLANMAZ (giriş gerekmez); takma-ad + skor.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_scores', function (Blueprint $table) {
            $table->id();
            $table->string('nickname', 20);
            $table->unsignedInteger('score');
            $table->unsignedInteger('correct_count');
            $table->string('ip_hash', 64)->nullable(); // hafif anti-spam görünürlüğü (sha256(ip))
            $table->timestamps();
            $table->index('score'); // tabela: ORDER BY score DESC
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_scores');
    }
};
