<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Yasaklılar panelinde "hangi kelimeden yasaklandı" göstermek için: son ihlali tetikleyen kelimeyi sakla.
 * "kullanıcı_token (eşleşen_kök)" biçimi (ör. "klasik (sik)") -> admin yanlış-pozitifi görüp karar verir.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'chat_offense_word')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('chat_offense_word', 120)->nullable()->after('chat_offenses');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'chat_offense_word')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('chat_offense_word');
            });
        }
    }
};
