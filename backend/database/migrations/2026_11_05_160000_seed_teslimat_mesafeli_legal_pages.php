<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Yeni yasal sayfalar (InfoPage::LEGAL_SLUGS'a eklendi) info_pages'e seed'lenir -> fresh DB / test
// de LEGAL_SLUGS bütünlüğünü sağlar (LegalCookieTest). Idempotent (updateOrInsert): üretimde zaten
// elle eklenmiş satırları günceller, yoksa ekler. Ayrıca "Gizlilik Politikası" -> "Gizlilik Sözleşmesi".
return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('info_pages')) {
            return;
        }

        $teslimat = <<<'HTML'
<h3>1. Kapsam ve Satıcı Bilgileri</h3><p>Bu şartlar, tavlatv.com üzerinden satılan tavla, hassas zar, kitap ve tavla aksesuarları ile yıllık premium üyelik ve dijital analiz hizmetlerinin teslimat, iptal ve iade koşullarını düzenler.</p><p><strong>Satıcı/sağlayıcı unvanı:</strong> [Şirketin tam ticari unvanı]<br><strong>Adres:</strong> [Şirketin açık adresi]<br><strong>Telefon:</strong> [İletişim telefonu]<br><strong>E-posta:</strong> bilgi@tavlatv.com<br><strong>Web sitesi:</strong> https://tavlatv.com</p><h3>2. Fiziksel Ürünlerin Teslimatı</h3><p>Tavla, hassas zar, kitap ve tavla aksesuarları, ödeme onayından sonra siparişte belirtilen teslimat adresine kargoyla gönderilir.</p><p>Hazırlık ve teslimat süreleri ürün sayfasında veya sipariş ekranında belirtilir. Kişiye özel hazırlanan ürünlere ilişkin yasal istisnalar dışında teslimat süresi 30 günü aşamaz.</p><p>Kargo ücreti ve varsa ücretsiz gönderim koşulları ödeme öncesinde gösterilir.</p><p><strong>Gönderim yapılan bölgeler:</strong> [Teslimat yapılan bölgeler]<br><strong>Anlaşmalı kargo firması:</strong> [Kargo firması]</p><p>Teslimat adresinin doğru ve eksiksiz girilmesi gerekir. Adres değişikliği talepleri, siparişin gönderim durumuna göre değerlendirilir.</p><p>Ürün tesliminde paketin kontrol edilmesi, görünür hasar varsa kargo görevlisinden tutanak istenmesi önerilir. Tutanak bulunmaması, tüketicinin yasal haklarını ortadan kaldırmaz.</p><h3>3. Yıllık Premium Üyeliğin Teslimatı</h3><p>Yıllık premium üyelik, ödeme onayının ardından satın alma ekranında belirtilen süre içinde ilgili kullanıcı hesabında etkinleştirilir. Fiziksel gönderim yapılmaz.</p><p>Üyeliğin başlangıç ve bitiş tarihleri ile sağladığı özellikler kullanıcıya bildirilir. Üyelik kapsamı, satın alma sırasında sunulan paket açıklamasına göre belirlenir.</p><p>Otomatik yenileme uygulanıyorsa yenileme bedeli, dönemi ve iptal yöntemi satın alma öncesinde ayrıca açıklanır. Aboneliğin feshi ve varsa kullanılmayan döneme ilişkin geri ödeme hakları ilgili mevzuata göre değerlendirilir.</p><h3>4. Analiz Hizmetinin Teslimatı</h3><p>Analiz hizmeti elektronik ortamda sunulur. Hizmetin kapsamı, analiz hakkı veya kullanım sınırları, gerekli dosya biçimleri ve sonuçların sunulma süresi ilgili hizmet açıklamasında belirtilir.</p><p>Hizmetin niteliğine göre teslimat; analiz özelliğinin hesaba açılması, analiz hakkının tanımlanması veya analiz sonucunun kullanıcıya sunulması yoluyla gerçekleştirilir.</p><p>Analiz için dosya veya maç bilgisi gerekiyorsa kullanıcı bu bilgileri belirtilen yöntemle iletir. Dosyanın eksik, bozuk veya desteklenmeyen biçimde olması hâlinde hizmetin tamamlanabilmesi için kullanıcıdan düzeltme istenebilir.</p><h3>5. Fiziksel Ürünlerde Cayma ve İade</h3><p>Yasal istisnalar dışında, ürünü teslim aldığınız tarihten itibaren <strong>14 gün içinde</strong> gerekçe göstermeden cayabilirsiniz. Bildiriminizi bilgi@tavlatv.com adresine gönderebilirsiniz.</p><p>Cayma bildiriminin ardından ürünü 14 gün içinde geri göndermeniz gerekir.</p><p>Ürünü, beraberinde teslim edilen parçalar ve aksesuarlarla birlikte, taşıma sırasında zarar görmeyecek biçimde paketleyiniz. Ürünün işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun şekilde incelenmesi nedeniyle meydana gelen değişiklikler cayma hakkını ortadan kaldırmaz.</p><p>Tesliminden sonra ambalaj, bant veya mühür gibi koruyucu unsurları açılan kitaplarda ve kişisel taleplere göre hazırlanan ürünlerde ilgili cayma hakkı istisnaları uygulanabilir. Bu istisnalar, ayıplı veya yanlış ürünlere ilişkin hakları kaldırmaz.</p><p><strong>İade adresi:</strong> [Açık iade adresi]<br><strong>İade için belirlenen kargo firması:</strong> [Kargo firması]</p><p>Belirtilen iade kargosuyla gönderimlerde iade masrafı tüketiciden alınmaz. İade kargosu belirtilmemişse de tüketici iade masrafından sorumlu tutulmaz.</p><h3>6. Dijital Hizmetlerde Cayma Hakkı</h3><p>Hizmet sözleşmelerinde genel cayma süresi sözleşmenin kurulduğu tarihten itibaren 14 gündür.</p><p>Elektronik ortamda anında sunulan hizmetler, anında teslim edilen gayrimaddi ürünler ve cayma süresi dolmadan tüketicinin onayıyla sunulmasına başlanan hizmetler bakımından yasal istisnalar uygulanabilir.</p><p>Yıllık premium üyelik ve analiz hizmetlerinde uygulanacak koşullar satın alma öncesinde açıklanır; gerekli onaylar ayrıca alınır. Hizmetin dijital olması, tek başına bütün iade ve fesih haklarını ortadan kaldırmaz.</p><h3>7. Hasarlı, Eksik veya Hatalı Teslimat</h3><p>Aşağıdaki durumlarda bilgi@tavlatv.com üzerinden başvurabilirsiniz:</p><ul><li>Ürünün hasarlı, eksik veya siparişten farklı teslim edilmesi.</li><li>Ödeme yapılmasına rağmen ürünün teslim edilmemesi.</li><li>Premium üyeliğin veya analiz hakkının hesaba tanımlanmaması.</li><li>Aynı sipariş için birden fazla tahsilat yapılması.</li><li>Sunulan ürün veya hizmetin açıklanan özellikleri karşılamaması.</li></ul><p>Sipariş numarası, işlem tarihi ve varsa sorunu gösteren fotoğrafların paylaşılması incelemeyi kolaylaştırır. Tüketicinin ayıplı mal ve hizmetlere ilişkin yasal seçimlik hakları saklıdır.</p><h3>8. Geri Ödeme</h3><p>Geçerli cayma işlemlerinde geri ödeme süresi en fazla 14 gündür. Bu süre fiziksel ürünlerde belirlenen iade kargosuna teslimden, farklı kargo kullanılırsa ürünün tarafımıza ulaşmasından; hizmetlerde ve henüz teslim edilmemiş ürünlerde cayma bildiriminden itibaren başlar.</p><p>Geri ödeme, kullanılan ödeme aracına uygun şekilde, tüketiciye ek masraf yüklenmeden yapılır. Bankanın işlemi hesap hareketlerine yansıtma süresi değişebilir.</p><h3>9. Başvuru ve Uyuşmazlıklar</h3><p>Teslimat, iptal ve iade taleplerinizi <strong>bilgi@tavlatv.com</strong> adresine iletebilirsiniz. Sipariş veya işlem numaranızı ve hesabınıza kayıtlı e-posta adresini belirtmeniz yeterlidir. Cayma hakkını kullanırken gerekçe sunmanız gerekmez.</p><p>Bu şartlar tüketicinin kanuni haklarını sınırlandırmaz. Uyuşmazlıklarda yasal koşullara göre tüketici hakem heyetlerine veya tüketici mahkemelerine başvurulabilir.</p>
HTML;

        $mesafeli = <<<'HTML'
<h3>1. Taraflar ve Konu</h3><p>Bu Mesafeli Satış Sözleşmesi, tavlatv.com üzerinden elektronik ortamda sipariş verilen fiziksel ürünler (tavla, hassas zar, kitap ve aksesuarlar) ile yıllık premium üyelik ve dijital analiz hizmetlerinin satışına ilişkin tarafların hak ve yükümlülüklerini düzenler. Sözleşme, siparişin elektronik ortamda onaylanmasıyla kurulur.</p><h3>2. Satıcı / Sağlayıcı Bilgileri</h3><p><strong>Unvan:</strong> [Şirketin tam ticari unvanı]<br><strong>Adres:</strong> [Şirketin açık adresi]<br><strong>Telefon:</strong> [İletişim telefonu]<br><strong>E-posta:</strong> bilgi@tavlatv.com<br><strong>Web sitesi:</strong> https://tavlatv.com</p><h3>3. Alıcı (Tüketici) Bilgileri</h3><p>Alıcının adı, teslimat ve fatura adresi, telefonu ve e-posta adresi, sipariş sırasında girilen bilgilerdir. Alıcı, bu bilgilerin doğru ve güncel olmasından sorumludur.</p><h3>4. Sözleşme Konusu Ürün/Hizmet ve Bedel</h3><p>Siparişe konu ürün veya hizmetin adı, adedi, satış bedeli, varsa kargo ücreti ve toplam ödeme tutarı, sipariş/ödeme ekranında gösterilir. Vergiler dâhil toplam bedel ödeme öncesinde açıkça belirtilir. Fiyatlar, güncelleme yapılmadığı sürece sipariş anındaki tutar üzerinden geçerlidir.</p><h3>5. Genel Hükümler</h3><p>Alıcı, ürün/hizmetin temel nitelikleri, satış bedeli, ödeme ve teslimat koşulları ile cayma hakkına dair ön bilgileri edindiğini ve elektronik ortamda onayladığını kabul eder. Sipariş onayı, satış bedelinin ilgili ödeme yöntemiyle tahsil edilmesiyle tamamlanır.</p><h3>6. Ödeme</h3><p>Ödemeler, sitede sunulan ödeme yöntemleriyle (kart/3D Secure vb.) güvenli altyapı üzerinden alınır. Ödeme bilgileri satıcı tarafından saklanmaz; işlem yetkili ödeme kuruluşu aracılığıyla gerçekleştirilir.</p><h3>7. Teslimat</h3><p>Fiziksel ürünler siparişte belirtilen adrese kargoyla gönderilir; dijital hizmetler (premium üyelik, analiz) elektronik ortamda ilgili hesaba tanımlanır. Teslimat süreleri, koşulları ve hasarlı/eksik teslimat halleri <strong>Teslimat ve İade Şartları</strong> sayfasında ayrıntılı düzenlenmiştir.</p><h3>8. Cayma Hakkı</h3><p>Alıcı, fiziksel ürünlerde teslim tarihinden, hizmetlerde sözleşmenin kurulduğu tarihten itibaren 14 gün içinde gerekçe göstermeden ve cezai şart ödemeden cayabilir. Cayma bildirimi bilgi@tavlatv.com adresine iletilir. Cayma ve iade sürecine ilişkin ayrıntılar Teslimat ve İade Şartları sayfasında yer alır.</p><h3>9. Cayma Hakkının İstisnaları</h3><p>Kişiye özel hazırlanan ürünler, tesliminden sonra koruyucu unsurları (ambalaj, bant, mühür) açılan kitaplar; elektronik ortamda anında ifa edilen ve anında teslim edilen gayrimaddi hizmetler ile cayma süresi dolmadan tüketicinin onayıyla ifasına başlanan hizmetlerde, mevzuatta öngörülen cayma hakkı istisnaları uygulanabilir. Bu istisnalar, ayıplı mal ve hizmete ilişkin yasal hakları ortadan kaldırmaz.</p><h3>10. Uyuşmazlıkların Çözümü ve Yürürlük</h3><p>Bu sözleşme tüketicinin kanuni haklarını sınırlandırmaz. Uyuşmazlıklarda, ilgili mevzuatta belirlenen parasal sınırlar çerçevesinde Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir. Sözleşme, siparişin elektronik olarak onaylandığı tarihte yürürlüğe girer.</p>
HTML;

        $now = now();
        DB::table('info_pages')->updateOrInsert(
            ['slug' => 'teslimat-ve-iade-sartlari'],
            [
                'title' => 'Teslimat ve İade Şartları',
                'body' => $teslimat,
                'gallery' => '[]', 'galleries' => '[]', 'sort' => 105, 'published' => true,
                'seo_title' => 'Teslimat ve İade Şartları',
                'seo_description' => 'TavlaTV teslimat, iptal, cayma ve iade koşulları: fiziksel ürünler, yıllık premium üyelik ve analiz hizmeti için teslimat süreleri, cayma hakkı ve geri ödeme.',
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );
        DB::table('info_pages')->updateOrInsert(
            ['slug' => 'mesafeli-satis-sozlesmesi'],
            [
                'title' => 'Mesafeli Satış Sözleşmesi',
                'body' => $mesafeli,
                'gallery' => '[]', 'galleries' => '[]', 'sort' => 106, 'published' => true,
                'seo_title' => 'Mesafeli Satış Sözleşmesi',
                'seo_description' => 'TavlaTV mesafeli satış sözleşmesi: taraflar, ürün/hizmet ve bedel, ödeme, teslimat, cayma hakkı ve istisnaları ile uyuşmazlık çözümü.',
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );

        // "Gizlilik Politikası" -> "Gizlilik Sözleşmesi" (slug sabit). Yalnız varsayılan başlıkta güncelle
        // (admin elle değiştirdiyse ezme).
        DB::table('info_pages')->where('slug', 'gizlilik-politikasi')
            ->where('title', 'Gizlilik Politikası')
            ->update(['title' => 'Gizlilik Sözleşmesi', 'seo_title' => 'Gizlilik Sözleşmesi', 'updated_at' => $now]);
    }

    public function down(): void
    {
        DB::table('info_pages')->whereIn('slug', ['teslimat-ve-iade-sartlari', 'mesafeli-satis-sozlesmesi'])->delete();
    }
};
