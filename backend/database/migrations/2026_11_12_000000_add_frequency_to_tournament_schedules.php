<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PERİYODİK TURNUVA SIKLIĞI: 'daily' (günlük, mevcut davranış) veya 'weekly' (haftalık).
// weekly = Pazartesi 00:00'da o haftanın TÜM seçili günleri için turnuvalar birden kurulur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_schedules', function (Blueprint $t) {
            $t->string('frequency', 10)->default('daily')->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_schedules', function (Blueprint $t) {
            $t->dropColumn('frequency');
        });
    }
};
