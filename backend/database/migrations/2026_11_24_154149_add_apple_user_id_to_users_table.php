<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Apple ile Giriş: Apple'in sabit kullanici kimligi (idToken 'sub'). Apple 2. giristen itibaren
// e-posta VERMEZ -> kullaniciyi e-posta degil BU kolonla eslestiririz. nullable (yalniz Apple ile
// baglanmis hesaplarda dolu), unique (bir Apple kimligi tek hesap).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('apple_user_id')->nullable()->unique()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('apple_user_id');
        });
    }
};
