<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Profil sıfırlama anı: MatchBackstop bu tarihten ÖNCE biten odaları GERİ YAZMASIN
            // (yoksa clean-slate sonrası son 2 günün online maçları sweep'le yeniden belirir).
            $table->timestamp('profile_reset_at')->nullable()->after('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('profile_reset_at');
        });
    }
};
