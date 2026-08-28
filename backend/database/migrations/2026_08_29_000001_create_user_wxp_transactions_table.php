<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// WXP (Kazanma Deneyim Puanlari) LEDGER — source of truth.
// Her kazanilan tamamlanmis mac icin bir immutable satir. Toplam WXP her zaman
// SUM(amount) ile yeniden uretilebilir. Cached users.total_wxp bundan turer.
//
// IDEMPOTENCY: (match_result_id, source) UNIQUE -> ayni mac sonucundan iki kez
// WXP verilemez (DB seviyesinde; application kontrolu tek basina yetmez). Sistemde
// sunucu-otoriteli match_id olmadigi icin idempotency anahtari match_result satiridir
// (reportRating her cagrida bir match_results satiri uretir; WXP o satira 1:1 baglanir).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_wxp_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('match_result_id')->nullable()->constrained('match_results')->nullOnDelete();
            $table->integer('amount'); // pozitif (>=1); bu kapsamda negatif WXP yok
            $table->string('source', 32)->default('match_win');
            $table->json('metadata')->nullable(); // {"match_length":7,"match_type":"match"}
            $table->timestamps();

            $table->unique(['match_result_id', 'source'], 'uwx_matchresult_source_uq');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_wxp_transactions');
    }
};
