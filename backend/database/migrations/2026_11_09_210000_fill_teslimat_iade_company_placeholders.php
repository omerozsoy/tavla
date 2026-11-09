<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// İptal ve İade + Teslimat yasal sayfalarındaki [yer tutucuları] gerçek şirket bilgileriyle doldurur.
// Kaynak: canlı KVKK sayfası (veri sorumlusu Caner ÇELİK). Kargo + teslimat bölgesi kullanıcı onayı.
// Idempotent: str_replace yalnız yer tutucu HÂLÂ varsa değiştirir (admin düzenlediyse no-op -> ezmez).
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('info_pages')) {
            return;
        }

        $adres = 'Yeni Mahallesi Radar Caddesi Şiir Sokak No:21 Kat:1 Daire:2 Kuruçeşme İzmit / KOCAELİ';
        $repl = [
            '[Şirketin tam ticari unvanı]' => 'Caner ÇELİK',
            '[Şirketin açık adresi]' => $adres,
            '[İletişim telefonu]' => '+90 537 389 19 07',
            '[Teslimat yapılan bölgeler]' => 'Türkiye geneli',
            '[Kargo firması]' => 'Yurtiçi Kargo',
            '[Açık iade adresi]' => $adres,
        ];

        foreach (['iptal-ve-iade', 'teslimat'] as $slug) {
            $row = DB::table('info_pages')->where('slug', $slug)->first(['body']);
            if (! $row || ! is_string($row->body)) {
                continue;
            }
            $new = strtr($row->body, $repl);
            if ($new !== $row->body) {
                DB::table('info_pages')->where('slug', $slug)
                    ->update(['body' => $new, 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        // Geri alınmaz: gerçek bilgiler yer tutucuya döndürülmez (içerik düzeltmesi, şema değil).
    }
};
