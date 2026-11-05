<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * E-ticaret yasal footer linkleri (Teslimat/İade + Mesafeli Satış) frontend footer'a eklenmişti ama
 * footer_links tablosuna hiç seed edilmemişti -> admin "Footer Bağlantıları"nda görünmüyorlardı
 * (sitede fallback idx ile görünüyor, admin'de satır yok). ITEMS'e eklendi; bu migration mevcut
 * üretim DB'sine satırları idempotent ekler + çerez-tercih'i yasal kolonun sonuna taşır.
 * Taze kurulumda create_footer_links zaten ITEMS'ten seed ettiği için insert-if-not-exists atlar.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('footer_links')) {
            return;
        }

        // Çerez tercihleri yasal kolonun EN SONUNA (yeni ikiliye yer aç).
        DB::table('footer_links')->where('item_key', 'legal-cerez-tercih')->update(['sort' => 7]);

        $rows = [
            ['item_key' => 'legal-teslimat', 'sort' => 5],
            ['item_key' => 'legal-mesafeli', 'sort' => 6],
        ];
        foreach ($rows as $r) {
            if (DB::table('footer_links')->where('item_key', $r['item_key'])->exists()) {
                continue;
            }
            DB::table('footer_links')->insert([
                'item_key' => $r['item_key'],
                'column_key' => 'legal',
                'sort' => $r['sort'],
                'visible' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('footer_links')) {
            return;
        }
        DB::table('footer_links')->whereIn('item_key', ['legal-teslimat', 'legal-mesafeli'])->delete();
    }
};
