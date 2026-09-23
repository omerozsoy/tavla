<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sistem/resmi hesap işareti. "Tavla TV Yönetim" toplu-mesaj hesabı gibi hesaplar
// bu bayrakla işaretlenir: liderlik tablosundan gizlenir, DM'de istek kutusuna
// düşmez (konuşma daima açık), oyuncu aramalarında çıkmaz. Giriş yapamaz.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'is_system')) {
                $table->boolean('is_system')->default(false)->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'is_system')) {
                $table->dropColumn('is_system');
            }
        });
    }
};
