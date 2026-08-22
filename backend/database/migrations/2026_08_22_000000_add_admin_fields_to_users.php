<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // DB tabanli yonetici bayragi (config e-posta listesiyle birlikte OR'lanir)
            $table->boolean('is_admin')->default(false)->after('email');
            // Yasakli hesap: dolu ise oturum acamaz
            $table->timestamp('banned_at')->nullable()->after('is_admin');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_admin', 'banned_at']);
        });
    }
};
