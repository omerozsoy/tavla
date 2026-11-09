<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Yasaklılar listesi arşivi: yasağı bitmiş (süresi dolmuş) ama ihlal geçmişi (chat_offenses>0)
// olan kullanıcılar admin'ce "arşivlenir" -> listede gizlenir AMA geçmiş (ceza sayacı) KORUNUR
// (tekrar ederse yine artan ceza). null = arşivlenmemiş.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'chat_mute_archived_at')) {
                $table->timestamp('chat_mute_archived_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('chat_mute_archived_at');
        });
    }
};
