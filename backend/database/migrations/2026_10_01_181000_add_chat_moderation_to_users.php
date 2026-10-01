<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sohbet küfür yaptırımı: konuşma yasağı bitişi + toplam ihlal sayısı (artan ceza:
// 1=24s, 2=1h, 3=1ay, 4+=1yıl). Oyun içi sohbet + DM ortak kullanır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'chat_muted_until')) {
                $table->timestamp('chat_muted_until')->nullable();
            }
            if (! Schema::hasColumn('users', 'chat_offenses')) {
                $table->unsignedInteger('chat_offenses')->default(0);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['chat_muted_until', 'chat_offenses']);
        });
    }
};
