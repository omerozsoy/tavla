<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('blunders', function (Blueprint $table) {
            $table->string('opp', 64)->nullable()->after('player');        // insan rakip adi (AI ise null)
            $table->unsignedTinyInteger('ai_level')->nullable()->after('opp'); // AI zorluk 1..10 (insan ise null)
            $table->unsignedTinyInteger('score_me')->nullable()->after('ai_level');  // mac bitiş skoru (benim)
            $table->unsignedTinyInteger('score_opp')->nullable()->after('score_me'); // mac bitiş skoru (rakip)
            $table->boolean('won')->nullable()->after('score_opp');        // maci kazandim mi
        });
    }

    public function down(): void
    {
        Schema::table('blunders', function (Blueprint $table) {
            $table->dropColumn(['opp', 'ai_level', 'score_me', 'score_opp', 'won']);
        });
    }
};
