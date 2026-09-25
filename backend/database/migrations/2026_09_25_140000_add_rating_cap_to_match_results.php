<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Arkadaş/kılıç (friendly) maçları artık PUANLI; anti-farm için "aynı rakiple 24 saatte en fazla
// N kez rating/PR" limiti gerekir. Bunun için:
//  - opponent_user_id: rakip hesap kimliği (limit sayımı bu kolon üzerinden yapılır; opponent_name
//    string olduğundan güvenilmez). Nullable (misafir/eski satırlar) + index (sık sorgulanır).
//  - rated: bu satır rating/PR kazandırdı mı (limit sayımı yalnız rated=true satırları sayar).
//    Varsayılan TRUE -> mevcut satırlar (puanlı maçlar) davranışı korunur; casual satırlar false yazılır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (! Schema::hasColumn('match_results', 'opponent_user_id')) {
                $t->unsignedBigInteger('opponent_user_id')->nullable()->after('opponent_name');
                $t->index(['user_id', 'opponent_user_id', 'created_at'], 'mr_user_opp_time_idx');
            }
            if (! Schema::hasColumn('match_results', 'rated')) {
                $t->boolean('rated')->default(true)->after('delta');
            }
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $t) {
            if (Schema::hasColumn('match_results', 'opponent_user_id')) {
                $t->dropIndex('mr_user_opp_time_idx');
                $t->dropColumn('opponent_user_id');
            }
            if (Schema::hasColumn('match_results', 'rated')) {
                $t->dropColumn('rated');
            }
        });
    }
};
