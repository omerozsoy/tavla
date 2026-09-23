<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contents')) {
            return;
        }

        // Önceki deneme kaydını kaldır; klasördeki başlangıç serisinin 00 kaydı
        // manifestteki önerilen başlık ve slug ile yeniden oluşturulur.
        DB::table('contents')
            ->where('type', 'makale')
            ->where('title', 'Tavlada Hamle Seçme Rehberi: Kapı, Kırma ve Kaçış')
            ->delete();

        $articles = [
            ['tavla-hamle-secme-stratejileri', 'Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji', 'Tavlada kapı almak, taş kırmak ve gerideki taşları çıkarmak için hamle rehberi.', 'tavla-hamle-secme-stratejileri.png', 0],
            ['tavla-nedir', 'Tavla Nedir? Oyunun Mantığı ve Temel Terimler', 'Tavla nedir, nasıl kazanılır ve hangi temel terimleri bilmelisiniz? Oyuna yeni başlayanlar için kısa ve anlaşılır bir giriş.', 'tavla-nedir.png', 1],
            ['tavla-nasil-oynanir', 'Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama', 'Tavla kurallarını adım adım öğrenin: 15 taşın dizilişi, zarlarla hareket, taş kırma, bar ve taş toplama.', 'tavla-nasil-oynanir.png', 2],
            ['tavla-acilis-zarlari-31-42-61-53-65', 'Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5', 'Tavlada 3–1, 4–2, 6–1, 5–3 ve 6–5 açılış zarları nasıl oynanır? Başlangıç konumunda örnek hamleler ve nedenleri.', 'tavla-acilis-zarlari-31-42-61-53-65.png', 3],
            ['tavla-acilis-zarlari-62-63-64', 'Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır?', '6–2, 6–3 ve 6–4 açılışlarında gerideki taşı çıkarma, kurucu taş getirme ve riskleri değerlendirme rehberi.', 'tavla-acilis-zarlari-62-63-64.png', 4],
            ['ilk-tavla-turnuvasina-katilim', 'İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi', 'İlk tavla turnuvasına katılmadan önce kayıt, kurallar, maç formatı ve oyun günü için pratik hazırlık listesi.', 'ilk-tavla-turnuvasina-katilim.png', 5],
            ['tavla-turnuvasinda-ilk-gun', 'Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım', 'Tavla turnuvasında kayıt, eşleşme, maç başlangıcı ve sonuç bildirimi nasıl ilerler? İlk gün için anlaşılır akış.', 'tavla-turnuvasinda-ilk-gun.png', 6],
            ['evde-tavla-oynama-rehberi', 'Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı', 'Evde tavla kurmak için gerekenler, maç formatı seçimi ve yeni başlayanların birlikte gelişmesi için öneriler.', 'evde-tavla-oynama-rehberi.png', 7],
            ['tavlaya-yeni-baslayanlar-rehberi', 'Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi', 'Tavlaya sıfırdan başlamak için kurallar, ilk stratejiler, sık hatalar ve pratik çalışma sırası.', 'tavlaya-yeni-baslayanlar-rehberi.png', 8],
        ];

        foreach ($articles as [$slug, $title, $description, $image, $sort]) {
            $path = base_path('database/data/makaleler/'.$slug.'.html');
            $body = is_file($path) ? (string) file_get_contents($path) : '';
            $body .= '<p>Konuyu pekiştirmek için <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberine göz atın; öğrendiklerinizi <a href="/yeni-oyun">yeni bir tavla maçında</a> deneyin. Turnuva ilgilenenler için <a href="/online-turnuvalar">online tavla turnuvaları</a> da burada.</p>';

            DB::table('contents')->updateOrInsert(
                ['type' => 'makale', 'title' => $title],
                [
                    'body' => $body,
                    'image' => '/uploads/makale/'.$image,
                    'published' => true,
                    'sort' => $sort,
                    'event_at' => '2026-09-23 12:00:00',
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }
    }

    public function down(): void
    {
        $titles = [
            'Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji',
            'Tavla Nedir? Oyunun Mantığı ve Temel Terimler',
            'Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama',
            'Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5',
            'Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır?',
            'İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi',
            'Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım',
            'Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı',
            'Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi',
        ];
        DB::table('contents')->where('type', 'makale')->whereIn('title', $titles)->delete();
    }
};
