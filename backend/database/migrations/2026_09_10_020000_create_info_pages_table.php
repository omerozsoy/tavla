<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('info_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();       // sabit: about/services/ranks/scoring/badges/fair
            $table->string('title');                // sekme etiketi (admin duzenler)
            $table->longText('body')->nullable();   // RichEditor HTML
            $table->json('gallery')->nullable();     // opsiyonel resim galerisi (lightbox)
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        // ---- Hakkinda: mevcut i18n (TR) icerigini HTML'e cevir (sadik seed) ----
        $features = [
            ['Tamamen Ücretsiz Oyun', 'İstediğin kadar oyna, oyunun keyfini çıkar.'],
            ['Güçlü Sinir Ağı Botu', '10 farklı zorluk seviyesinde yapay zekâya meydan oku.'],
            ['Gerçek Oyuncularla Online Oyun', 'Rakibini bul, masaya otur ve yeteneğini göster.'],
            ['Puanlı Eşleşmeler', 'Rekabetçi maçlara katıl, puanını yükselt.'],
            ['Liderlik Tablosu', 'En iyi oyuncular arasındaki yerini gör.'],
            ['Rütbe Sistemi', 'Oynadıkça yüksel, yeni rütbelere ulaş.'],
            ['Maç Sonrası Hata Analizi', 'Hatalarını gör, oyununu analiz et ve kendini geliştir.'],
            ['Medyan Hata Oranı', 'Oyun kaliteni ölç, performansındaki gelişimi takip et.'],
            ['Detaylı Zar İstatistikleri', 'Gelen zarları ve maç boyunca oluşan zar verilerini incele.'],
            ['Kanıtlanabilir Adil Zar (Provably Fair)', 'Zar sonuçlarının adilliğini doğrulayabileceğin şeffaf sistem.'],
            ['Yüzlerce Board ve Renk Seçeneği', 'Tavla tahtanı kendi tarzına göre kişiselleştir.'],
            ['Sayısız Avatar', 'Tarzını yansıtan avatarını seç.'],
            ['Avatar Çerçeveleri ve Özel Efektler', 'Profilini özel çerçeveler ve animasyonlarla kişiselleştir.'],
            ['Coin Sistemi', 'Oyna, kazan ve coinlerini biriktir.'],
            ['Mağaza ve Koleksiyon Sistemi', 'Board, avatar, çerçeve ve özel içeriklerden koleksiyonunu oluştur.'],
            ['Detaylı Oyuncu İstatistikleri', 'Maçlarını, galibiyetlerini ve performansını takip et.'],
            ['Günlük Performans Analizi', 'Günlük oyun performansını ve yaptığın hataları takip et.'],
            ['Başarılarım ve Ödüller', 'Görevleri tamamla, başarımları aç ve ödüller kazan.'],
            ['Her Seviyeye Uygun', 'Yeni başlayanlardan deneyimli tavla oyuncularına kadar herkes için.'],
            ['Tarayıcıdan Anında Oyna', 'İndirme yapmadan doğrudan oyuna başla.'],
        ];
        $lis = '';
        foreach ($features as [$t, $d]) {
            $lis .= '<li>'.e($t).' — '.e($d).'</li>';
        }
        $aboutBody = '<p>TavlaTV, tarayıcıda oynanan modern bir tavla platformudur. Yapay zekaya karşı '
            .'antrenman yapabilir, gerçek rakiplerle eşleşebilir, turnuvalara katılabilir ve her maçının '
            .'analizini görebilirsin.</p>'
            .'<h3>Öne çıkanlar</h3><ul>'.$lis.'</ul>'
            .'<h3>İletişim</h3><p>Görüş ve önerilerin için bize ulaşabilirsin: destek@tavlatv.com</p>';

        // ---- Hizmetler: mevcut Content type='service' kayitlarini TEK sayfaya birlestir ----
        $servicesBody = '';
        $servicesGallery = [];
        if (Schema::hasTable('contents')) {
            $rows = DB::table('contents')->where('type', 'service')
                ->orderBy('sort')->orderBy('id')->get();
            foreach ($rows as $r) {
                $servicesBody .= '<h3>'.e($r->title).'</h3>';
                $body = (string) ($r->body ?? '');
                // RichEditor HTML ise oldugu gibi; duz metinse paragrafa sar.
                $servicesBody .= str_contains($body, '<') ? $body : '<p>'.nl2br(e($body)).'</p>';
                $g = json_decode($r->gallery ?? '[]', true);
                if (is_array($g)) {
                    foreach ($g as $img) {
                        if (is_string($img) && $img !== '') {
                            $servicesGallery[] = $img;
                        }
                    }
                }
            }
        }
        if ($servicesBody === '') {
            $servicesBody = '<p>Hizmetlerimiz yakında burada listelenecek.</p>';
        }

        $now = now();
        $pages = [
            ['about', 'Hakkında', $aboutBody, null, 1],
            ['services', 'Hizmetler', $servicesBody, $servicesGallery ? json_encode(array_values($servicesGallery)) : null, 2],
            ['ranks', 'Rütbeler',
                "<p>TavlaTV'de her oyuncunun bir rütbesi vardır. Rütben, puanına (rating) göre belirlenir ve oynadıkça yükselir.</p>"
                .'<p>Puanlı maçlar kazandıkça puanın artar ve yeni rütbelere ulaşırsın. Rütbeler, tavla yolculuğundaki gelişimini gösterir.</p>',
                null, 3],
            ['scoring', 'Puanlama',
                '<p>Puanlı maçlarda kazandığında puanın artar, kaybettiğinde azalır. Puan değişimi rakibinin gücüne göre hesaplanır: güçlü bir rakibi yenmek daha çok puan kazandırır.</p>'
                .'<p>Ayrıca her maçında medyan hata oranın (PR) ölçülür; bu değer oyun kaliteni gösterir ve düştükçe daha iyi oynuyorsun demektir.</p>',
                null, 4],
            ['badges', 'Başarılarım',
                '<p>Görevleri tamamladıkça başarımlarını (rozetlerini) açarsın. Oynadığın maçlar, kazandığın turnuvalar ve ulaştığın kilometre taşları yeni rozetler kazandırır.</p>'
                .'<p>Kazandığın rozetleri profilinde görebilir ve koleksiyonunu tamamlayabilirsin.</p>',
                null, 5],
            ['fair', 'Adil Zar',
                "<p>TavlaTV'de zarlar kanıtlanabilir şekilde adildir (provably fair). Her maçta zar sonuçları, önceden belirlenen ve kurcalanamayan kriptografik bir yöntemle üretilir.</p>"
                .'<p>Maç sonunda sunucu tohumunu (server seed) açıklarız; böylece zarların önceden değiştirilmediğini kendin doğrulayabilirsin.</p>',
                null, 6],
        ];
        foreach ($pages as [$slug, $title, $body, $gallery, $sort]) {
            DB::table('info_pages')->insert([
                'slug' => $slug,
                'title' => $title,
                'body' => $body,
                'gallery' => $gallery,
                'sort' => $sort,
                'published' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('info_pages');
    }
};
