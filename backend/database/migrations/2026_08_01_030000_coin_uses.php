<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('last_daily')->nullable()->after('avatar_frame'); // gunluk odul tarihi
        });
        Schema::table('tournaments', function (Blueprint $table) {
            $table->integer('entry_fee')->default(0)->after('prize_coins'); // katilim ucreti (coin)
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_daily');
        });
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('entry_fee');
        });
    }
};
