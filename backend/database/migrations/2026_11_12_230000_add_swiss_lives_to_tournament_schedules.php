<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Zamanlanmış Swiss turnuvasında "hak sayısı" (3 Haklı Swiss: 1/2/3) artık şablonda seçilir;
// CreateScheduledTournaments bunu kurulan turnuvaya aktarır. bracket bu sütunu yok sayar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_schedules', function (Blueprint $t) {
            if (! Schema::hasColumn('tournament_schedules', 'swiss_lives')) {
                $t->unsignedTinyInteger('swiss_lives')->default(3)->after('type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournament_schedules', function (Blueprint $t) {
            if (Schema::hasColumn('tournament_schedules', 'swiss_lives')) {
                $t->dropColumn('swiss_lives');
            }
        });
    }
};
