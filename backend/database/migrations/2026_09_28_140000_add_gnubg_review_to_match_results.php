<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Analiz ekranının hamle-hamle gnubg review'ini (LogEntry[] + alternatifler) İLK açılışta
 * bu satıra önbellekler. Sonraki açılışlar gnubg'yi hiç çalıştırmadan anında döner. .mat log'dan
 * deterministiktir ve maç bittikten sonra değişmez -> önbellek güvenle kalıcıdır. Nullable ->
 * henüz açılmamış/eski maçlar boş kalır (ilk açılışta dolar). DB cache flush/deploy'dan etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->longText('gnubg_review')->nullable();     // reviewMatch sonucu (JSON)
            $table->timestamp('gnubg_review_at')->nullable(); // ne zaman önbelleklendi
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['gnubg_review', 'gnubg_review_at']);
        });
    }
};
