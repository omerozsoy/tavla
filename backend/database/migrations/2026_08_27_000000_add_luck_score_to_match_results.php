<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('luck')->nullable()->after('pr');          // insanin goreceli sansi (zero-sum)
            $table->smallInteger('score_self')->nullable()->after('luck'); // mac sonu kendi puani
            $table->smallInteger('score_opp')->nullable()->after('score_self'); // rakip puani
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['luck', 'score_self', 'score_opp']);
        });
    }
};
