<?php

namespace Database\Seeders;

use App\Models\InfoPage;
use Illuminate\Database\Seeder;

/**
 * KLASIK TAVLA KURALLARI bilgi sayfası (/bilgi/klasik-tavla-kurallari).
 * Metin, kodun UYGULADIĞI kurallarla BİREBİR eşleşir (hareket/zorunlu-zar/toplama: paylaşılan
 * motor src/engine; küp yok + mars=2: Backgammon::gamePoints($classic) + cubeAvailility CLASSIC_NO_CUBE).
 * Idempotent: slug'a göre upsert. Deploy'da `php artisan db:seed --class=ClassicTavlaRulesSeeder`
 * (veya DatabaseSeeder'dan çağrılır) ile yayınlanır; sonra admin panelden düzenlenebilir.
 */
class ClassicTavlaRulesSeeder extends Seeder
{
    public function run(): void
    {
        $body = <<<'HTML'
<h2>Klasik Tavla Kuralları</h2>
<p>Klasik Tavla, standart tavlanın küpsüz ve sade puanlamalı sürümüdür. Hareket, zar
kullanımı, kırma ve taş toplama kuralları normal tavlayla <strong>birebir aynıdır</strong>;
tek farkları: <strong>katlama küpü yoktur</strong> ve <strong>mars 2 puandır</strong> (3 puanlık
backgammon/katmerli mars yoktur).</p>

<h3>1. Tahta ve başlangıç dizilimi</h3>
<ul>
  <li>Oyun iki kişiyle oynanır; her oyuncunun 15 taşı vardır.</li>
  <li>Her oyuncu kendi bakış açısından: <strong>24. hanede 2</strong>, <strong>13. hanede 5</strong>,
      <strong>8. hanede 3</strong> ve <strong>6. hanede 5</strong> taşla başlar.</li>
  <li>Oyuncular taşlarını zıt yönlerde, kendi iç sahalarına (1–6. haneler) doğru ilerletir.</li>
</ul>

<h3>2. Oyuna başlama</h3>
<ul>
  <li>Her oyunun başında iki oyuncu da birer zar atar. Zarlar eşitse açılış yeniden atılır.</li>
  <li>Büyük zarı atan oyuncu başlar ve açılışta çıkan bu iki zarla ilk hamlesini yapar;
      ayrıca yeni bir çift zar atmaz.</li>
  <li>Sonraki oyunlarda da başlangıç aynı şekilde belirlenir: her oyunda açılış zarı yeniden atılır,
      büyük zarı atan başlar (sırayla/kaybeden başlar kuralı yoktur).</li>
</ul>

<h3>3. Zarlar ve taş hareketleri</h3>
<ul>
  <li>Sırası gelen oyuncu iki zar atar; her zar ayrı bir hareket hakkıdır.</li>
  <li>Zarlar farklı taşlarla ya da aynı taşla sırayla kullanılabilir. Aynı taşla iki zar
      kullanılacaksa <strong>ara hane de yasal olmalıdır</strong>; iki zarın toplamıyla kapalı ara haneyi
      atlamak yasaktır.</li>
  <li>Çift (eş) zar gelirse aynı sayı dört kez oynanır.</li>
</ul>

<h3>4. Zorunlu zar kullanımı</h3>
<ul>
  <li>İki zarın da oynanabildiği bir sıra varsa ikisi de kullanılmalıdır.</li>
  <li>Yalnız bir zar oynanabiliyorsa o zar kullanılır.</li>
  <li>Her iki zar ayrı ayrı oynanabiliyor ama birlikte oynanamıyorsa <strong>büyük zar</strong> oynanır.</li>
  <li>Çift zarda mümkün olan en fazla hareket yapılmalıdır.</li>
  <li>Hiçbir yasal hareket yoksa sıra rakibe geçer.</li>
  <li>Daha fazla zar kullanılabilecekken daha az kullanıp tur bitirilemez — turun bütün yasal
      hareket dizileri değerlendirilir, en çok zarı kullandıran sıra zorunludur.</li>
</ul>

<h3>5. Kapılar ve taş kırma</h3>
<ul>
  <li>Taş; boş haneye, kendi taşının bulunduğu haneye veya rakibin <strong>tek</strong> taşının
      bulunduğu haneye gidebilir.</li>
  <li>Rakibin iki veya daha fazla taşı bulunan hane kapalıdır.</li>
  <li>Rakibin tek taşı bulunan haneye gidilirse o taş kırılır ve bara alınır.</li>
</ul>

<h3>6. Kırık taşın oyuna girmesi</h3>
<ul>
  <li>Barda taşı olan oyuncu önce onları oyuna sokar; bar boşalmadan tahtadaki başka taş oynanamaz.</li>
  <li>Giriş rakibin iç sahasınadır: zar 1 → 24, zar 2 → 23, …, zar 6 → 19.</li>
  <li>Giriş hanesinde rakibin iki+ taşı varsa o zarla girilemez; tek taşı varsa o taş kırılır.</li>
  <li>Son kırık taş girdikten sonra kalan zarlarla normal hareket yapılır. Girişte de maksimum
      zar kullanımı ve gerektiğinde büyük zarı oynama zorunluluğu geçerlidir.</li>
</ul>

<h3>7. Taş toplama</h3>
<ul>
  <li>Oyuncu ancak 15 taşının tamamı iç sahasındayken (ve barda taşı yokken) toplamaya başlar.</li>
  <li>Gelen zarın gösterdiği haneden bir taş toplanır.</li>
  <li>O hanede taş yoksa: daha yüksek numaralı hanede kendi taşı varsa önce yasal bir iç saha
      hareketi yapılır; daha yüksek hanede taşı yoksa kalan en yüksek haneden taş toplanabilir.</li>
  <li>Toplama sırasında taşı kırılan oyuncu, kırık taşı sokup tüm taşlarını iç sahaya getirmeden
      toplamaya devam edemez.</li>
  <li>Toplamada da iki zarı kullanma, büyük zar ve çift zarda maksimum hareket kuralları geçerlidir.</li>
</ul>

<h3>8. Galibiyet ve puanlama</h3>
<ul>
  <li>15 taşını önce toplayan oyuncu kazanır.</li>
  <li>Kaybeden en az bir taş topladıysa: <strong>normal galibiyet — 1 puan</strong>.</li>
  <li>Kaybeden hiç taş toplamadıysa: <strong>mars — 2 puan</strong>.</li>
  <li>Bu modda <strong>katlama küpü yoktur</strong> ve ayrı bir 3 puanlık backgammon kuralı yoktur:
      kaybedenin barda ya da kazananın iç sahasında taşı kalması marsı 3 puana çıkarmaz.</li>
  <li>Crawford, Jacoby ve beaver kuralları bu modda <strong>yoktur</strong>.</li>
  <li>Maç hedef puanı oda ayarından gelir (5, 7 veya 9). Hedefe ulaşan oyuncu maçı kazanır.</li>
</ul>

<h3>9. Süre, terk ve bağlantı</h3>
<p>Süre aşımı, maçtan çekilme ve bağlantı kopması sonuçları platformun genel kurallarına göre
ayrıca uygulanır (bunlar doğal oyun sonu ve mars hesabından bağımsızdır). Süresi biten / maçı terk
eden taraf hükmen kaybeder; haksız kazanç (hiç oynamayan tarafın hükmen kazanması) için platformun
emniyet kuralları devrededir.</p>
HTML;

        InfoPage::updateOrCreate(
            ['slug' => 'klasik-tavla-kurallari'],
            [
                'title' => 'Klasik Tavla Kuralları',
                'seo_title' => 'Klasik Tavla Kuralları — Küpsüz, Mars 2 Puan',
                'seo_description' => 'Klasik Tavla: standart tavla kuralları, küp yok, mars 2 puan. Başlangıç dizilimi, zorunlu zar kullanımı, bara giriş, taş toplama ve puanlama.',
                'body' => $body,
                // "Bilgi" (Eğitim) footer kolonunda, Geleneksel Tavla Kuralları ile aynı grupta.
                'section' => 'footer:guide',
                'sort' => 1,
                'published' => true,
            ],
        );
    }
}
