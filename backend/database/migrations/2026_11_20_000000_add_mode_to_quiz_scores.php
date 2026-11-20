<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Soru Maratonu iki ayrı yarışma: 'checker' (pul/hamle) ve 'cube' (küp). Ayrı tabela.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_scores', function (Blueprint $table) {
            $table->string('mode', 16)->default('checker')->index()->after('correct_count');
        });
    }

    public function down(): void
    {
        Schema::table('quiz_scores', function (Blueprint $table) {
            $table->dropColumn('mode');
        });
    }
};
