<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Bilgi › Sözlük" sayfasindaki BASLANGIC (seed) terimlerini temizler (kullanici istegi):
 * body bosaltilir. Sayfa/menu ogesi kalir; icerik admin panelden (Bilgi Sayfalari) doldurulur.
 * Tek seferlik veri migration'i; admin sonradan icerik girerse tekrar CALISMAZ (migrate bir kez).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('info_pages')) {
            return;
        }
        DB::table('info_pages')->where('slug', 'glossary')->update([
            'body' => '',
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        // Geri alinamaz (silinen terimler geri getirilmez); no-op.
    }
};
