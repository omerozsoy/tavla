<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('unlocks')->nullable()->after('coins');       // satin alinan kozmetikler
            $table->string('avatar_frame')->nullable()->after('unlocks'); // secili avatar cercevesi
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['unlocks', 'avatar_frame']);
        });
    }
};
