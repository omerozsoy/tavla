<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Hukuki sayfalar artik "Bilgi Sayfalari" (info_pages) altinda yonetilir. Bu migration:
// 1) info_pages'e seo_title/seo_description ekler,
// 2) daha once legal_pages'e tohumlanan 5 hukuki sayfayi info_pages'e TASIR (idempotent).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('info_pages', function (Blueprint $table) {
            if (! Schema::hasColumn('info_pages', 'seo_title')) {
                $table->string('seo_title', 160)->nullable()->after('title');
            }
            if (! Schema::hasColumn('info_pages', 'seo_description')) {
                $table->string('seo_description', 320)->nullable()->after('seo_title');
            }
        });

        if (! Schema::hasTable('legal_pages')) {
            return;
        }
        $now = now();
        foreach (DB::table('legal_pages')->orderBy('sort')->orderBy('id')->get() as $i => $r) {
            if (DB::table('info_pages')->where('slug', $r->slug)->exists()) {
                continue; // admin zaten olusturmus/duzenlemis -> ezme
            }
            DB::table('info_pages')->insert([
                'slug' => $r->slug,
                'title' => $r->title,
                'seo_title' => $r->seo_title ?? null,
                'seo_description' => $r->seo_description ?? null,
                'body' => $r->body,
                'gallery' => null,
                'galleries' => null,
                'sort' => 100 + (int) ($r->sort ?? $i), // Bilgi sekmelerinden sonra
                'published' => (bool) ($r->active ?? true),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Kolonlar geri alinmaz (veri kaybini onlemek icin).
    }
};
