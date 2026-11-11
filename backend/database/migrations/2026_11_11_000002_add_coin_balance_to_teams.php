<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Takım BAKİYESİ: ortak coin kasası. Sezon şampiyonu +30.000 buraya yazılır; kurucu/yardımcı
 * bu bakiyeden üyelerin kişisel cüzdanına coin dağıtır (TeamService::grantFromBalance).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->unsignedBigInteger('coin_balance')->default(0)->after('rating_avg');
        });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn('coin_balance');
        });
    }
};
