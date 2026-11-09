<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Eski birleşik "Teslimat ve İade Şartları" (slug teslimat-ve-iade-sartlari) İKİ ayrı yasal sayfaya
// bölündü: "İptal ve İade" (iptal-ve-iade) + "Teslimat" (teslimat). InfoPage::LEGAL_SLUGS + web.php
// allowlist + FooterLink::ITEMS + frontend 4 nokta ile senkron. Eski slug tamamen kaldırılır (404).
// Idempotent. Footer: iptal-iade(5)/teslimat(6) ikilisi uyelik ile mesafeli arasına; legal-teslimat
// satırı yeniden kullanılır (artık "Teslimat"), legal-iptal-iade eklenir.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('info_pages')) {
            return;
        }

        $teslimat = <<<'HTML'
<h3>1. Kapsam ve Satıcı Bilgileri</h3><p>Bu şartlar, tavlatv.com üzerinden satılan tavla, hassas zar, kitap ve tavla aksesuarları ile yıllık premium üyelik ve dijital analiz hizmetlerinin teslimat koşullarını düzenler. İptal, cayma ve iade koşulları için <strong>İptal ve İade</strong> sayfasına bakınız.</p><p><strong>Satıcı/sağlayıcı unvanı:</strong> [Şirketin tam ticari unvanı]<br><strong>Adres:</strong> [Şirketin açık adresi]<br><strong>Telefon:</strong> [İletişim telefonu]<br><strong>E-posta:</strong> bilgi@tavlatv.com<br><strong>Web sitesi:</strong> https://tavlatv.com</p><h3>2. Fiziksel Ürünlerin Teslimatı</h3><p>Tavla, hassas zar, kitap ve tavla aksesuarları, ödeme onayından sonra siparişte belirtilen teslimat adresine kargoyla gönderilir.</p><p>Hazırlık ve teslimat süreleri ürün sayfasında veya sipariş ekranında belirtilir. Kişiye özel hazırlanan ürünlere ilişkin yasal istisnalar dışında teslimat süresi 30 günü aşamaz.</p><p>Kargo ücreti ve varsa ücretsiz gönderim koşulları ödeme öncesinde gösterilir.</p><p><strong>Gönderim yapılan bölgeler:</strong> [Teslimat yapılan bölgeler]<br><strong>Anlaşmalı kargo firması:</strong> [Kargo firması]</p><p>Teslimat adresinin doğru ve eksiksiz girilmesi gerekir. Adres değişikliği talepleri, siparişin gönderim durumuna göre değerlendirilir.</p><p>Ürün tesliminde paketin kontrol edilmesi, görünür hasar varsa kargo görevlisinden tutanak istenmesi önerilir. Tutanak bulunmaması, tüketicinin yasal haklarını ortadan kaldırmaz.</p><h3>3. Yıllık Premium Üyeliğin Teslimatı</h3><p>Yıllık premium üyelik, ödeme onayının ardından satın alma ekranında belirtilen süre içinde ilgili kullanıcı hesabında etkinleştirilir. Fiziksel gönderim yapılmaz.</p><p>Üyeliğin başlangıç ve bitiş tarihleri ile sağladığı özellikler kullanıcıya bildirilir. Üyelik kapsamı, satın alma sırasında sunulan paket açıklamasına göre belirlenir.</p><p>Otomatik yenileme uygulanıyorsa yenileme bedeli, dönemi ve iptal yöntemi satın alma öncesinde ayrıca açıklanır. Aboneliğin feshi ve varsa kullanılmayan döneme ilişkin geri ödeme hakları ilgili mevzuata göre değerlendirilir.</p><h3>4. Analiz Hizmetinin Teslimatı</h3><p>Analiz hizmeti elektronik ortamda sunulur. Hizmetin kapsamı, analiz hakkı veya kullanım sınırları, gerekli dosya biçimleri ve sonuçların sunulma süresi ilgili hizmet açıklamasında belirtilir.</p><p>Hizmetin niteliğine göre teslimat; analiz özelliğinin hesaba açılması, analiz hakkının tanımlanması veya analiz sonucunun kullanıcıya sunulması yoluyla gerçekleştirilir.</p><p>Analiz için dosya veya maç bilgisi gerekiyorsa kullanıcı bu bilgileri belirtilen yöntemle iletir. Dosyanın eksik, bozuk veya desteklenmeyen biçimde olması hâlinde hizmetin tamamlanabilmesi için kullanıcıdan düzeltme istenebilir.</p><h3>5. Hasarlı, Eksik veya Hatalı Teslimat</h3><p>Aşağıdaki durumlarda bilgi@tavlatv.com üzerinden başvurabilirsiniz:</p><ul><li>Ürünün hasarlı, eksik veya siparişten farklı teslim edilmesi.</li><li>Ödeme yapılmasına rağmen ürünün teslim edilmemesi.</li><li>Premium üyeliğin veya analiz hakkının hesaba tanımlanmaması.</li><li>Aynı sipariş için birden fazla tahsilat yapılması.</li><li>Sunulan ürün veya hizmetin açıklanan özellikleri karşılamaması.</li></ul><p>Sipariş numarası, işlem tarihi ve varsa sorunu gösteren fotoğrafların paylaşılması incelemeyi kolaylaştırır. Tüketicinin ayıplı mal ve hizmetlere ilişkin yasal seçimlik hakları saklıdır. İade ve geri ödeme süreci için <strong>İptal ve İade</strong> sayfasına bakınız.</p><h3>6. Başvuru</h3><p>Teslimatla ilgili taleplerinizi <strong>bilgi@tavlatv.com</strong> adresine iletebilirsiniz. Sipariş veya işlem numaranızı ve hesabınıza kayıtlı e-posta adresini belirtmeniz yeterlidir. Bu şartlar tüketicinin kanuni haklarını sınırlandırmaz.</p>
HTML;

        $iptalIade = <<<'HTML'
<h3>1. Kapsam ve Satıcı Bilgileri</h3><p>Bu şartlar, tavlatv.com üzerinden satılan tavla, hassas zar, kitap ve tavla aksesuarları ile yıllık premium üyelik ve dijital analiz hizmetlerinin iptal, cayma, iade ve geri ödeme koşullarını düzenler. Teslimat süreleri ve koşulları için <strong>Teslimat</strong> sayfasına bakınız.</p><p><strong>Satıcı/sağlayıcı unvanı:</strong> [Şirketin tam ticari unvanı]<br><strong>Adres:</strong> [Şirketin açık adresi]<br><strong>Telefon:</strong> [İletişim telefonu]<br><strong>E-posta:</strong> bilgi@tavlatv.com<br><strong>Web sitesi:</strong> https://tavlatv.com</p><h3>2. Fiziksel Ürünlerde Cayma ve İade</h3><p>Yasal istisnalar dışında, ürünü teslim aldığınız tarihten itibaren <strong>14 gün içinde</strong> gerekçe göstermeden cayabilirsiniz. Bildiriminizi bilgi@tavlatv.com adresine gönderebilirsiniz.</p><p>Cayma bildiriminin ardından ürünü 14 gün içinde geri göndermeniz gerekir.</p><p>Ürünü, beraberinde teslim edilen parçalar ve aksesuarlarla birlikte, taşıma sırasında zarar görmeyecek biçimde paketleyiniz. Ürünün işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun şekilde incelenmesi nedeniyle meydana gelen değişiklikler cayma hakkını ortadan kaldırmaz.</p><p>Tesliminden sonra ambalaj, bant veya mühür gibi koruyucu unsurları açılan kitaplarda ve kişisel taleplere göre hazırlanan ürünlerde ilgili cayma hakkı istisnaları uygulanabilir. Bu istisnalar, ayıplı veya yanlış ürünlere ilişkin hakları kaldırmaz.</p><p><strong>İade adresi:</strong> [Açık iade adresi]<br><strong>İade için belirlenen kargo firması:</strong> [Kargo firması]</p><p>Belirtilen iade kargosuyla gönderimlerde iade masrafı tüketiciden alınmaz. İade kargosu belirtilmemişse de tüketici iade masrafından sorumlu tutulmaz.</p><h3>3. Dijital Hizmetlerde Cayma Hakkı</h3><p>Hizmet sözleşmelerinde genel cayma süresi sözleşmenin kurulduğu tarihten itibaren 14 gündür.</p><p>Elektronik ortamda anında sunulan hizmetler, anında teslim edilen gayrimaddi ürünler ve cayma süresi dolmadan tüketicinin onayıyla sunulmasına başlanan hizmetler bakımından yasal istisnalar uygulanabilir.</p><p>Yıllık premium üyelik ve analiz hizmetlerinde uygulanacak koşullar satın alma öncesinde açıklanır; gerekli onaylar ayrıca alınır. Hizmetin dijital olması, tek başına bütün iade ve fesih haklarını ortadan kaldırmaz.</p><h3>4. Sipariş İptali</h3><p>Henüz kargoya verilmemiş fiziksel ürün siparişlerinin iptalini bilgi@tavlatv.com üzerinden talep edebilirsiniz. Ödemesi alınmış iptal taleplerinde bedel, aşağıdaki geri ödeme koşullarına göre iade edilir. Kargoya verilmiş siparişlerde cayma ve iade hükümleri uygulanır.</p><h3>5. Geri Ödeme</h3><p>Geçerli cayma veya iptal işlemlerinde geri ödeme süresi en fazla 14 gündür. Bu süre fiziksel ürünlerde belirlenen iade kargosuna teslimden, farklı kargo kullanılırsa ürünün tarafımıza ulaşmasından; hizmetlerde ve henüz teslim edilmemiş ürünlerde cayma veya iptal bildiriminden itibaren başlar.</p><p>Geri ödeme, kullanılan ödeme aracına uygun şekilde, tüketiciye ek masraf yüklenmeden yapılır. Bankanın işlemi hesap hareketlerine yansıtma süresi değişebilir.</p><h3>6. Başvuru ve Uyuşmazlıklar</h3><p>İptal, cayma ve iade taleplerinizi <strong>bilgi@tavlatv.com</strong> adresine iletebilirsiniz. Sipariş veya işlem numaranızı ve hesabınıza kayıtlı e-posta adresini belirtmeniz yeterlidir. Cayma hakkını kullanırken gerekçe sunmanız gerekmez.</p><p>Bu şartlar tüketicinin kanuni haklarını sınırlandırmaz. Uyuşmazlıklarda yasal koşullara göre tüketici hakem heyetlerine veya tüketici mahkemelerine başvurulabilir.</p>
HTML;

        $now = now();
        DB::table('info_pages')->updateOrInsert(
            ['slug' => 'iptal-ve-iade'],
            [
                'title' => 'İptal ve İade',
                'body' => $iptalIade,
                'gallery' => '[]', 'galleries' => '[]', 'sort' => 105, 'published' => true,
                'seo_title' => 'İptal ve İade',
                'seo_description' => 'TavlaTV iptal, cayma, iade ve geri ödeme koşulları: fiziksel ürünler, yıllık premium üyelik ve analiz hizmeti için 14 günlük cayma hakkı, istisnalar ve geri ödeme süreleri.',
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );
        DB::table('info_pages')->updateOrInsert(
            ['slug' => 'teslimat'],
            [
                'title' => 'Teslimat',
                'body' => $teslimat,
                'gallery' => '[]', 'galleries' => '[]', 'sort' => 106, 'published' => true,
                'seo_title' => 'Teslimat',
                'seo_description' => 'TavlaTV teslimat koşulları: fiziksel ürünlerde kargo ve teslimat süreleri, yıllık premium üyelik ve analiz hizmetinin hesaba tanımlanması, hasarlı/eksik teslimat başvurusu.',
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );

        // Eski birleşik sayfa kaldırılır (artık iki ayrı sayfa; eski URL 404).
        DB::table('info_pages')->where('slug', 'teslimat-ve-iade-sartlari')->delete();

        // Mesafeli Satış Sözleşmesi'ndeki "Teslimat ve İade Şartları sayfası" referansları yeni
        // iki sayfaya yönlendirilir. Yalnız eski ifade hâlâ geçiyorsa değiştir (admin düzenlediyse
        // atla) -> idempotent + güvenli.
        $m = DB::table('info_pages')->where('slug', 'mesafeli-satis-sozlesmesi')->first(['body']);
        if ($m && is_string($m->body) && str_contains($m->body, 'Teslimat ve İade Şartları')) {
            $body = str_replace(
                [
                    '<strong>Teslimat ve İade Şartları</strong> sayfasında ayrıntılı düzenlenmiştir.',
                    'Teslimat ve İade Şartları sayfasında yer alır.',
                ],
                [
                    '<strong>Teslimat</strong> sayfasında ayrıntılı düzenlenmiştir.',
                    '<strong>İptal ve İade</strong> sayfasında yer alır.',
                ],
                $m->body,
            );
            DB::table('info_pages')->where('slug', 'mesafeli-satis-sozlesmesi')
                ->update(['body' => $body, 'updated_at' => $now]);
        }

        // Footer bağlantıları: yasal kolonda iptal-iade(5)/teslimat(6) ikilisi, ardından
        // mesafeli(7)/çerez-tercih(8). legal-teslimat satırı yeniden kullanılır (artık "Teslimat").
        if (Schema::hasTable('footer_links')) {
            DB::table('footer_links')->where('item_key', 'legal-teslimat')->update(['sort' => 6]);
            DB::table('footer_links')->where('item_key', 'legal-mesafeli')->update(['sort' => 7]);
            DB::table('footer_links')->where('item_key', 'legal-cerez-tercih')->update(['sort' => 8]);
            if (! DB::table('footer_links')->where('item_key', 'legal-iptal-iade')->exists()) {
                DB::table('footer_links')->insert([
                    'item_key' => 'legal-iptal-iade',
                    'column_key' => 'legal',
                    'sort' => 5,
                    'visible' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('info_pages')) {
            DB::table('info_pages')->whereIn('slug', ['iptal-ve-iade', 'teslimat'])->delete();
        }
        if (Schema::hasTable('footer_links')) {
            DB::table('footer_links')->where('item_key', 'legal-iptal-iade')->delete();
        }
    }
};
