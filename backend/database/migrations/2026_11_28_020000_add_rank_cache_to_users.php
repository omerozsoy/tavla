<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Efektif rütbe için PR/EP önbelleği. rank:refresh sırasında doldurulur -> admin önizlemesi
 * (eşik değiştirmeden "kaç oyuncu etkilenir") 2148 kullanıcıyı yeniden analiz etmeden,
 * tek SELECT + bellek-içi eşik uygulamasıyla ANINDA hesaplar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->float('rank_window_pr')->nullable()->after('rank_key');
            $table->unsignedInteger('rank_ep')->nullable()->after('rank_window_pr');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['rank_window_pr', 'rank_ep']);
        });
    }
};
