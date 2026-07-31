<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('coins')->default(0)->after('rating'); // odul coin bakiyesi
        });
        Schema::table('tournaments', function (Blueprint $table) {
            $table->integer('prize_coins')->default(0)->after('status'); // sampiyona coin odulu
            $table->string('prize_desc')->nullable()->after('prize_coins'); // ek odul aciklamasi
            $table->boolean('prize_paid')->default(false)->after('prize_desc'); // odendi mi
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('coins');
        });
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn(['prize_coins', 'prize_desc', 'prize_paid']);
        });
    }
};
