<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('wins')->default(0)->after('rating');          // kazanilan mac
            $table->integer('losses')->default(0)->after('wins');          // kaybedilen mac
            $table->integer('games_played')->default(0)->after('losses');  // toplam mac
            $table->index('rating'); // liderlik siralamasi icin
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['rating']);
            $table->dropColumn(['wins', 'losses', 'games_played']);
        });
    }
};
