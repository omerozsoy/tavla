<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Uyarı anındaki takma adı sakla. tavla:nickname-enforce "takma ad uyarıdan bu yana DEĞİŞTİ mi?"
// ölçütünü kullanır (filtreye takılmayan ELLE eklenen hesaplar da banlanabilsin). Değişmişse uyarı
// temizlenir, değişmeyip süre dolmuşsa hesap kapatılır. Idempotent.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'nickname_warned_nick')) {
                $table->string('nickname_warned_nick')->nullable()->after('nickname_ban_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'nickname_warned_nick')) {
                $table->dropColumn('nickname_warned_nick');
            }
        });
    }
};
