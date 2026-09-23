<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// İçeriklere (özellikle makale) kısa/SEO-dostu URL slug'ı: /makaleler/<slug>.
// Önceden detay slug'ı slugify(title) (uzun başlık) idi; sitemap + App.tsx SEO_TITLES
// KISA slug kullandığından derin-linkler 404 veriyordu. Bu kolon kısa slug'ı OTORİTİF
// yapar (sitemap ile birebir). Boşsa frontend/backend slugify(title)'a düşer (haber/blog
// davranışı değişmez).
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contents')) {
            return;
        }
        if (! Schema::hasColumn('contents', 'slug')) {
            Schema::table('contents', function (Blueprint $t) {
                $t->string('slug', 200)->nullable()->after('title')->index();
            });
        }

        // Mevcut (canlı) makale satırlarının kısa slug'ını başlığa göre doldur — sitemap +
        // SeoMeta MAKALE_META + App.tsx SEO_TITLES ile birebir. (seed 170000 ile aynı harita.)
        $map = [
            'tavla-hamle-secme-stratejileri' => 'Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji',
            'tavla-nedir' => 'Tavla Nedir? Oyunun Mantığı ve Temel Terimler',
            'tavla-nasil-oynanir' => 'Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama',
            'tavla-acilis-zarlari-31-42-61-53-65' => 'Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5',
            'tavla-acilis-zarlari-62-63-64' => 'Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır?',
            'ilk-tavla-turnuvasina-katilim' => 'İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi',
            'tavla-turnuvasinda-ilk-gun' => 'Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım',
            'evde-tavla-oynama-rehberi' => 'Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı',
            'tavlaya-yeni-baslayanlar-rehberi' => 'Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi',
        ];
        foreach ($map as $slug => $title) {
            DB::table('contents')
                ->where('type', 'makale')
                ->where('title', $title)
                ->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('contents') && Schema::hasColumn('contents', 'slug')) {
            Schema::table('contents', function (Blueprint $t) {
                $t->dropColumn('slug');
            });
        }
    }
};
