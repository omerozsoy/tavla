<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $articles = [
            ['tavla-hamle-secme-stratejileri', 'Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji'],
            ['tavla-nedir', 'Tavla Nedir? Oyunun Mantığı ve Temel Terimler'],
            ['tavla-nasil-oynanir', 'Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama'],
            ['tavla-acilis-zarlari-31-42-61-53-65', 'Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5'],
            ['tavla-acilis-zarlari-62-63-64', 'Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır?'],
            ['ilk-tavla-turnuvasina-katilim', 'İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi'],
            ['tavla-turnuvasinda-ilk-gun', 'Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım'],
            ['evde-tavla-oynama-rehberi', 'Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı'],
            ['tavlaya-yeni-baslayanlar-rehberi', 'Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi'],
        ];

        foreach ($articles as [$slug, $title]) {
            $path = base_path('database/data/makaleler/'.$slug.'.html');
            if (! is_file($path)) {
                continue;
            }

            $body = (string) file_get_contents($path);
            $body .= '<p>Konuyu pekiştirmek için <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberine göz atın; öğrendiklerinizi <a href="/yeni-oyun">yeni bir tavla maçında</a> deneyin. Turnuva ilgilenenler için <a href="/online-turnuvalar">online tavla turnuvaları</a> da burada.</p>';

            DB::table('contents')
                ->where('type', 'makale')
                ->where('title', $title)
                ->update(['body' => $body, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // İçerik gövdeleri bir önceki migration tarafından üretildiği için geri alma işlemi yoktur.
    }
};
