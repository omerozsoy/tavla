<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Küfürlü takma ad uyarı/son-tarih alanları. Admin uyarı gönderince nickname_warned_at=şimdi,
// nickname_ban_at=son tarih yazılır; süre dolup takma ad hâlâ uygunsuzsa tavla:nickname-enforce
// hesabı kapatır (AccountClosure). Takma ad düzeltilirse enforce alanları temizler. Idempotent.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'nickname_warned_at')) {
                $table->timestamp('nickname_warned_at')->nullable()->after('nickname_history');
            }
            if (! Schema::hasColumn('users', 'nickname_ban_at')) {
                $table->timestamp('nickname_ban_at')->nullable()->index()->after('nickname_warned_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['nickname_ban_at', 'nickname_warned_at'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
