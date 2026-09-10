<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Hukuki sayfalar + cerez tablosu + cerez onay metinleri icin TASLAK icerik tohumu.
 * IDEMPOTENT: yalnizca kayit YOKSA ekler -> admin duzenlemeleri asla ezilmez.
 * Metinler TASLAKTIR; nihai hukuki uygunluk sirket/hukuk danismani kontrolune tabidir.
 * Kose parantezli alanlar ([SIRKET UNVANI] vb.) panelden doldurulmalidir.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // ---- 1) Hukuki sayfalar (slug yoksa ekle) ----
        foreach ($this->legalPages() as $sort => $p) {
            if (DB::table('legal_pages')->where('slug', $p['slug'])->exists()) {
                continue;
            }
            DB::table('legal_pages')->insert([
                'slug' => $p['slug'],
                'title' => $p['title'],
                'seo_title' => $p['title'],
                'seo_description' => $p['seo'],
                'body' => $p['body'],
                'active' => true,
                'sort' => $sort,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // ---- 2) Cerez tablosu (tablo bossa tohumla) ----
        if (DB::table('cookie_entries')->count() === 0) {
            $sort = 0;
            foreach ($this->cookies() as $c) {
                DB::table('cookie_entries')->insert(array_merge($c, [
                    'sort' => $sort++,
                    'active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }

        // ---- 3) Cerez onay metinleri (tekil satir; bos alanlari doldur) ----
        $row = DB::table('cookie_consent_settings')->where('id', 1)->first();
        $defaults = $this->consentDefaults();
        if (! $row) {
            DB::table('cookie_consent_settings')->insert(array_merge(['id' => 1], $defaults, [
                'consent_version' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        } else {
            // Yalnizca BOS alanlari doldur (admin girdisini ezme).
            $patch = [];
            foreach ($defaults as $k => $v) {
                if (empty($row->{$k})) {
                    $patch[$k] = $v;
                }
            }
            if ($patch) {
                DB::table('cookie_consent_settings')->where('id', 1)->update($patch + ['updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        // Icerik tohumu geri alinmaz (admin duzenlemis olabilir).
    }

    private function consentDefaults(): array
    {
        return [
            'banner_title' => 'Çerez Tercihleriniz',
            'banner_body' => 'Size daha iyi bir deneyim sunmak, oturumunuzu güvenli şekilde yönetmek, site kullanımını analiz etmek ve tercihlerinizi hatırlamak için çerezler kullanıyoruz. Zorunlu çerezler sitenin çalışması için gereklidir. Diğer çerezlerin kullanımına ilişkin tercihlerinizi dilediğiniz zaman belirleyebilirsiniz.',
            'modal_title' => 'Çerez Tercihleri',
            'modal_desc' => 'Çerez tercihlerinizi aşağıdan yönetebilirsiniz. Zorunlu çerezler, internet sitesinin temel işlevlerinin çalışabilmesi için gereklidir ve devre dışı bırakılamaz. Diğer kategoriler için tercihinizi değiştirebilirsiniz.',
            'desc_necessary' => 'Bu çerezler internet sitesinin güvenli ve doğru şekilde çalışması için gereklidir. Oturum yönetimi, güvenlik, kullanıcı girişi ve temel site özellikleri bu kapsamda değerlendirilebilir.',
            'desc_functional' => 'Tercihlerinizin hatırlanması ve internet sitesinin size daha uygun şekilde çalışması için kullanılan çerezlerdir.',
            'desc_analytics' => 'İnternet sitesinin nasıl kullanıldığını anlamamıza, performansı ölçmemize ve kullanıcı deneyimini geliştirmemize yardımcı olan çerezlerdir.',
            'desc_marketing' => 'İzin vermeniz halinde reklamların ve pazarlama faaliyetlerinin etkinliğini ölçmek ve daha ilgili içerikler sunmak amacıyla kullanılan çerezlerdir.',
        ];
    }

    private function cookies(): array
    {
        return [
            ['name' => 'tavla.token', 'provider' => 'Birinci taraf (site)', 'category' => 'necessary', 'duration' => 'Kalıcı (çıkış yapınca silinir)', 'purpose' => 'Oturum/kimlik doğrulama jetonu. Giriş yapmış kullanıcının güvenli şekilde tanınmasını sağlar.'],
            ['name' => 'tavla.gate', 'provider' => 'Birinci taraf (site)', 'category' => 'necessary', 'duration' => 'Kalıcı', 'purpose' => 'Kapalı test dönemi erişim anahtarı (kullanılıyorsa).'],
            ['name' => 'XSRF-TOKEN / oturum çerezi', 'provider' => 'Birinci taraf (site)', 'category' => 'necessary', 'duration' => 'Oturum', 'purpose' => 'Güvenlik (CSRF koruması) ve oturum yönetimi. Yalnızca web-oturum tabanlı akışlarda oluşturulur.'],
            ['name' => 'tavla.cookieConsent', 'provider' => 'Birinci taraf (site)', 'category' => 'necessary', 'duration' => 'Kalıcı', 'purpose' => 'Çerez tercihlerinizi (onay kategorileri ve sürümü) saklar; her ziyarette tekrar sorulmaması için gereklidir.'],
            ['name' => 'tavla.lang', 'provider' => 'Birinci taraf (site)', 'category' => 'functional', 'duration' => 'Kalıcı', 'purpose' => 'Seçtiğiniz arayüz dilini hatırlar.'],
            ['name' => 'tavla.theme / tavla.board / tavla.move / tavla.animoff / tavla.learn', 'provider' => 'Birinci taraf (site)', 'category' => 'functional', 'duration' => 'Kalıcı', 'purpose' => 'Tema, tahta görünümü, taş hareket stili ve animasyon/öğrenme tercihlerinizi hatırlar.'],
            ['name' => 'cart', 'provider' => 'Birinci taraf (site)', 'category' => 'functional', 'duration' => 'Kalıcı', 'purpose' => 'Alışveriş sepetinizin içeriğini yerel olarak saklar.'],
            ['name' => 'tavla.entryPopupSeen / tavla.entryPopupDay', 'provider' => 'Birinci taraf (site)', 'category' => 'functional', 'duration' => 'Kalıcı', 'purpose' => 'Giriş duyuru banner’ının size gereğinden sık gösterilmemesini sağlar.'],
            ['name' => 'Google ile Giriş (GSI) çerezleri', 'provider' => 'Google LLC', 'category' => 'necessary', 'duration' => 'Google tarafından belirlenir', 'purpose' => '“Google ile giriş” özelliğini kullandığınızda Google tarafından oturum açma amacıyla ayarlanabilir.'],
        ];
    }

    private function legalPages(): array
    {
        $ph = '<p><em>Not: Aşağıdaki köşeli parantezli alanlar ([ŞİRKET UNVANI], [ADRES], [KEP ADRESİ], [E-POSTA], [TELEFON], [VERGİ DAİRESİ/NO]) şirket bilgileriyle Yönetim Paneli’nden doldurulmalıdır.</em></p>';

        return [
            [
                'slug' => 'kvkk',
                'title' => 'Kişisel Verilerin Korunması ve Aydınlatma Metni',
                'seo' => '6698 sayılı KVKK kapsamında kişisel verilerinizin işlenmesine ilişkin aydınlatma metni.',
                'body' => $ph.
                    '<p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, internet sitemizi ziyaret eden ve hizmetlerimizden yararlanan kullanıcıların kişisel verilerinin korunmasına önem veriyoruz.</p>'.
                    '<p>Bu Aydınlatma Metni; kişisel verilerinizin hangi amaçlarla işlendiği, hangi yöntemlerle toplandığı, kimlere ve hangi amaçlarla aktarılabileceği ile KVKK kapsamındaki haklarınız hakkında bilgi vermek amacıyla hazırlanmıştır.</p>'.
                    '<h2>1. Veri Sorumlusu</h2><p>Veri sorumlusu: [ŞİRKET UNVANI]. Adres: [ADRES]. KEP: [KEP ADRESİ]. E-posta: [E-POSTA]. Telefon: [TELEFON].</p>'.
                    '<h2>2. İşlenen Kişisel Veriler</h2><p>Hizmetlerimizin kullanımı sırasında, yalnızca gerekli olan aşağıdaki veriler işlenebilir:</p><ul>'.
                    '<li><strong>Kimlik/hesap:</strong> ad, soyad, kullanıcı adı (takma ad), doğum tarihi (isteğe bağlı), profil görseli (avatar).</li>'.
                    '<li><strong>İletişim:</strong> e-posta adresi. Fiziksel ürün siparişi verirseniz teslimat/fatura için ad, telefon, adres, il/ilçe, posta kodu ve (fatura için) vergi dairesi/numarası veya kimlik numarası.</li>'.
                    '<li><strong>Konum (ülke/il):</strong> profilinizde belirttiğiniz ülke ve il bilgisi (isteğe bağlı).</li>'.
                    '<li><strong>Üyelik ve oyun verileri:</strong> puan (rating), galibiyet/mağlubiyet istatistikleri, oyun içi sanal bakiye (coin), üyelik planı, oyun/maç kayıtları ve hamle logları, kullanıcı tercihleri.</li>'.
                    '<li><strong>Mesajlaşma:</strong> diğer kullanıcılara gönderdiğiniz özel mesajların içeriği.</li>'.
                    '<li><strong>İşlem/ödeme:</strong> satın alma işlemlerine ilişkin sipariş numarası, tutar, para birimi ve işlem durumu. <strong>Kart bilgileriniz (kart numarası, son kullanma, CVV) tarafımızca SAKLANMAZ;</strong> ödeme işlemi anlaşmalı ödeme kuruluşu (banka/sanal POS) tarafından 3D Secure ile gerçekleştirilir.</li>'.
                    '<li><strong>Teknik veriler:</strong> ödeme işlemleri sırasında güvenlik amacıyla IP adresi ve tarayıcı/cihaz bilgileri işlenebilir; sunucu kayıtlarında bağlantı bilgileri tutulabilir.</li>'.
                    '</ul><p>Sitemize Google hesabınızla giriş yapmayı seçerseniz, Google’dan ad, e-posta ve profil fotoğrafı bilgileri alınır.</p>'.
                    '<h2>3. Kişisel Verilerin İşlenme Amaçları</h2><ul>'.
                    '<li>Üyelik kaydının oluşturulması ve yönetimi, kullanıcı girişinin sağlanması,</li>'.
                    '<li>Oyun hizmetlerinin sunulması, eşleştirme, puan/istatistik ve oyun kayıtlarının tutulması,</li>'.
                    '<li>Satın alma, sanal bakiye (coin) ve üyelik işlemlerinin yürütülmesi,</li>'.
                    '<li>Güvenliğin sağlanması, hile/kötüye kullanımın önlenmesi,</li>'.
                    '<li>Talep ve şikâyetlerin yanıtlanması, yasal yükümlülüklerin yerine getirilmesi.</li></ul>'.
                    '<h2>4. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebepleri</h2><p>Verileriniz; üyelik/kayıt formları, site ve oyun kullanımı, çerezler ve benzeri teknolojiler ile ödeme akışları üzerinden elektronik ortamda toplanır. Hukuki sebepler: bir sözleşmenin kurulması/ifası için gerekli olması, hukuki yükümlülüğün yerine getirilmesi, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5-6).</p>'.
                    '<h2>5. Kişisel Verilerin Aktarılması</h2><p>Verileriniz; hizmetin sunulması için gerekli olduğu ölçüde, anlaşmalı ödeme kuruluşları, barındırma (hosting) sağlayıcıları ve yasal olarak yetkili kamu kurumları ile mevzuata uygun şekilde paylaşılabilir. Google ile giriş, Google Fonts ve benzeri üçüncü taraf hizmetleri kullanıldığında ilgili sağlayıcılara teknik veri (ör. IP) aktarımı söz konusu olabilir.</p>'.
                    '<h2>6. Kişisel Verilerin Saklanması ve Güvenliği</h2><p>Kişisel verileriniz, işlenme amacının gerektirdiği ve mevzuatın öngördüğü süreler boyunca saklanır; sürenin dolmasının ardından silinir, yok edilir veya anonim hale getirilir. Verilerin güvenliği için uygun teknik ve idari tedbirler alınır (ör. parolaların şifrelenmiş/karma olarak tutulması).</p>'.
                    '<h2>7. İlgili Kişinin KVKK Kapsamındaki Hakları</h2><p>KVKK m.11 uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, yurt içinde/dışında aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini/yok edilmesini isteme, düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.</p>'.
                    '<h2>8. Başvuru ve İletişim</h2><p>Haklarınıza ilişkin taleplerinizi [E-POSTA] veya [KEP ADRESİ] üzerinden ya da [ADRES] adresine yazılı olarak iletebilirsiniz. Başvurularınız, mevzuatta öngörülen süre içinde sonuçlandırılır.</p>',
            ],
            [
                'slug' => 'gizlilik-politikasi',
                'title' => 'Gizlilik Politikası',
                'seo' => 'Hangi bilgilerin işlendiğini ve nasıl kullanıldığını açıklayan gizlilik politikamız.',
                'body' => $ph.
                    '<p>Gizliliğiniz bizim için önemlidir. Bu Gizlilik Politikası, internet sitemizi ve hizmetlerimizi kullandığınızda hangi bilgilerin işlendiğini ve bu bilgilerin hangi amaçlarla kullanıldığını açıklamaktadır.</p>'.
                    '<h2>Genel</h2><p>Bu politika, KVKK Aydınlatma Metni ve Çerez Politikası ile birlikte değerlendirilmelidir.</p>'.
                    '<h2>Toplanan Bilgiler</h2><ul><li>Hesap bilgileri: ad, soyad, kullanıcı adı, e-posta, doğum tarihi (isteğe bağlı), avatar, ülke/il (isteğe bağlı).</li><li>Oyun verileri: puan, istatistikler, oyun/maç kayıtları, sanal bakiye (coin), üyelik planı, tercihler.</li><li>Özel mesaj içerikleri.</li><li>Fiziksel ürün siparişinde teslimat/fatura bilgileri.</li><li>Ödeme işlem kayıtları (sipariş no, tutar, durum). Kart bilgileri saklanmaz.</li><li>Teknik bilgiler: ödeme/güvenlik amaçlı IP ve tarayıcı bilgisi.</li></ul>'.
                    '<h2>Bilgilerin Kullanım Amaçları</h2><p>Hizmetin sunulması, hesabın yönetimi, güvenlik, işlemlerin yürütülmesi, yasal yükümlülükler ve kullanıcı deneyiminin iyileştirilmesi.</p>'.
                    '<h2>Hesap ve Güvenlik</h2><p>Parolanız güvenli (karma) biçimde saklanır. Hesap güvenliğiniz için parolanızı gizli tutmanız önemlidir.</p>'.
                    '<h2>Oyun ve İşlem Kayıtları</h2><p>Adil oyun, hile önleme, analiz ve anlaşmazlıkların çözümü için oyun/maç kayıtları ve işlem kayıtları tutulur.</p>'.
                    '<h2>Çerezler</h2><p>Çerezler ve benzeri teknolojiler hakkında ayrıntılı bilgi için Çerez Politikası’na bakınız. Tercihlerinizi çerez tercihleri ekranından yönetebilirsiniz.</p>'.
                    '<h2>Üçüncü Taraf Hizmetleri</h2><p>Google ile giriş, Google Fonts (yazı tipleri), bayrak görselleri sağlayıcısı ve ödeme kuruluşu gibi üçüncü taraf hizmetleri kullanılmaktadır. Bu hizmetler kendi gizlilik politikalarına tabidir.</p>'.
                    '<h2>Veri Güvenliği</h2><p>Verilerinizi korumak için uygun teknik ve idari tedbirler uygulanır.</p>'.
                    '<h2>Veri Saklama</h2><p>Veriler, amaca ve mevzuata uygun süreler boyunca saklanır; süre dolduğunda silinir, yok edilir veya anonimleştirilir.</p>'.
                    '<h2>Kullanıcı Hakları</h2><p>KVKK m.11 kapsamındaki haklarınızı KVKK Aydınlatma Metni’nde belirtilen yöntemlerle kullanabilirsiniz. Hesabınızı silme talebinde bulunabilirsiniz.</p>'.
                    '<h2>Politika Değişiklikleri</h2><p>Bu politika zaman zaman güncellenebilir. Önemli değişikliklerde sizi uygun yöntemlerle bilgilendiririz.</p>'.
                    '<h2>İletişim</h2><p>Sorularınız için: [E-POSTA].</p>',
            ],
            [
                'slug' => 'cerez-politikasi',
                'title' => 'Çerez Politikası',
                'seo' => 'Sitemizde kullanılan çerezler ve tercihlerinizi nasıl yönetebileceğiniz.',
                'body' => $ph.
                    '<p>Bu Çerez Politikası, internet sitemizde kullanılan çerezler ve benzeri teknolojiler hakkında bilgi vermek ve kullanıcıların çerez tercihlerini nasıl yönetebileceğini açıklamak amacıyla hazırlanmıştır.</p>'.
                    '<h2>1. Çerez Nedir?</h2><p>Çerezler, bir internet sitesini ziyaret ettiğinizde cihazınıza kaydedilen küçük metin dosyalarıdır. Sitemiz ayrıca tarayıcınızın yerel depolama (localStorage/sessionStorage) alanını da benzer amaçlarla kullanır.</p>'.
                    '<h2>2. Çerezleri Neden Kullanıyoruz?</h2><p>Oturumunuzu güvenli yönetmek, tercihlerinizi hatırlamak, siteyi geliştirmek ve (izin verirseniz) kullanımını ölçmek için.</p>'.
                    '<h2>3. Zorunlu Çerezler</h2><p>Sitenin güvenli ve doğru çalışması için gereklidir; oturum yönetimi, güvenlik ve kullanıcı girişi bu kapsamdadır. Devre dışı bırakılamaz.</p>'.
                    '<h2>4. İşlevsel Çerezler</h2><p>Tercihlerinizin (dil, tema, görünüm) hatırlanması için kullanılır.</p>'.
                    '<h2>5. Analitik Çerezler</h2><p>Sitenin nasıl kullanıldığını anlamamıza ve performansı ölçmemize yardımcı olur. Yalnızca onay verirseniz kullanılır.</p>'.
                    '<h2>6. Pazarlama Çerezleri</h2><p>Reklam/pazarlama etkinliğini ölçmek ve daha ilgili içerik sunmak için kullanılır. Yalnızca onay verirseniz kullanılır.</p>'.
                    '<h2>7. Kullanılan Çerezler</h2><p>Aşağıdaki tabloda sitemizde kullanılan çerez ve benzeri teknolojiler yer alır. Bu tablo, Yönetim Paneli’nden güncellenebilir.</p>[[COOKIE_TABLE]]'.
                    '<h2>8. Çerez Tercihlerinin Yönetilmesi</h2><p>Çerez tercihlerinizi sitedeki “Çerez Tercihleri” ekranından dilediğiniz zaman değiştirebilirsiniz. Ayrıca tarayıcınızın ayarlarından da çerezleri yönetebilir/silebilirsiniz; ancak zorunlu çerezleri engellemeniz hâlinde bazı özellikler çalışmayabilir.</p>'.
                    '<h2>9. Politika Değişiklikleri</h2><p>Bu politika güncellenebilir. Önemli değişikliklerde çerez onayınız yeniden istenebilir.</p>'.
                    '<h2>10. İletişim</h2><p>Sorularınız için: [E-POSTA].</p>',
            ],
            [
                'slug' => 'kullanim-kosullari',
                'title' => 'Kullanım Koşulları',
                'seo' => 'Platformun kullanımına ilişkin koşullar, kullanıcı yükümlülükleri ve yasaklı davranışlar.',
                'body' => $ph.
                    '<h2>Genel Hükümler</h2><p>Bu Kullanım Koşulları, internet sitemizi ve hizmetlerimizi kullanımınızı düzenler. Siteyi kullanarak bu koşulları kabul etmiş sayılırsınız.</p>'.
                    '<h2>Hizmetin Kapsamı</h2><p>Platform; çevrimiçi tavla oyunu, oyun analizi, turnuvalar, sanal bakiye (coin) ile kozmetik ve mağaza işlemleri ile ilgili özellikleri sunar.</p>'.
                    '<h2>Kullanıcı Hesapları</h2><p>Bazı özellikler için hesap oluşturmanız gerekir. Verdiğiniz bilgilerin doğru ve güncel olmasından siz sorumlusunuz.</p>'.
                    '<h2>Kullanıcı Yükümlülükleri</h2><p>Hizmetleri hukuka ve bu koşullara uygun kullanmayı kabul edersiniz.</p>'.
                    '<h2>Oyun Kuralları</h2><p>Oyunlar standart tavla kurallarına ve platformun ilan ettiği kurallara göre oynanır. Zar üretimi ve sonuçlar sunucu tarafından yönetilir.</p>'.
                    '<h2>Yasaklı Davranışlar</h2><ul>'.
                    '<li>Hile yazılımı, bot veya otomatik araç kullanmak,</li>'.
                    '<li>Birden fazla hesap (çoklu hesap) ile haksız avantaj sağlamak,</li>'.
                    '<li>Oyunu, eşleştirmeyi, puanı veya ekonomiyi manipüle etmek,</li>'.
                    '<li>Güvenlik açıklarından yararlanmak veya sistemi kötüye kullanmak,</li>'.
                    '<li>Diğer kullanıcıları rahatsız etmek, taciz etmek, hakaret veya tehdit içeren davranışlarda bulunmak,</li>'.
                    '<li>Yasa dışı, yanıltıcı veya üçüncü kişilerin haklarını ihlal eden içerik paylaşmak.</li></ul>'.
                    '<h2>Hesabın Askıya Alınması veya Kapatılması</h2><p>Bu koşulların ihlali hâlinde hesabınız uyarılmaksızın askıya alınabilir veya kapatılabilir; ilgili sanal bakiye ve ayrıcalıklar kısıtlanabilir.</p>'.
                    '<h2>Fikri Mülkiyet Hakları</h2><p>Site içeriği, tasarımı, yazılımı ve markaları ilgili hak sahiplerine aittir; izinsiz kullanılamaz.</p>'.
                    '<h2>Hizmette Değişiklikler</h2><p>Hizmetin kapsamını, özelliklerini ve bu koşulları zaman zaman güncelleyebiliriz.</p>'.
                    '<h2>Sorumluluğun Sınırları</h2><p>Hizmet “olduğu gibi” sunulur. Mevzuatın izin verdiği ölçüde, dolaylı zararlardan sorumluluk kabul edilmez.</p>'.
                    '<h2>Uygulanacak Hükümler</h2><p>Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır; uyuşmazlıklarda [YETKİLİ MAHKEME/İCRA DAİRESİ] yetkilidir.</p>'.
                    '<h2>İletişim</h2><p>Sorularınız için: [E-POSTA].</p>',
            ],
            [
                'slug' => 'uyelik-sozlesmesi',
                'title' => 'Üyelik Sözleşmesi',
                'seo' => 'Üyelik şartları, kullanıcı hak ve yükümlülükleri, sanal bakiye ve premium üyelik koşulları.',
                'body' => $ph.
                    '<h2>Taraflar ve Sözleşmenin Konusu</h2><p>Bu Üyelik Sözleşmesi, [ŞİRKET UNVANI] ("Platform") ile siteye üye olan kullanıcı arasında düzenlenmiştir. Konusu, üyeliğin ve hizmetlerin kullanım koşullarıdır.</p>'.
                    '<h2>Üyelik Şartları</h2><p>Üyelik için gerekli bilgileri doğru şekilde vermeniz gerekir. Bazı bonus/ödüllerin verilmesi e-posta adresinizin doğrulanmasına bağlı olabilir.</p>'.
                    '<h2>Hesap Oluşturma</h2><p>Ad, soyad, kullanıcı adı, e-posta ve parola ile hesap oluşturulur; Google ile giriş de mümkündür.</p>'.
                    '<h2>Kullanıcının Hak ve Yükümlülükleri</h2><p>Hizmetleri bu sözleşmeye ve Kullanım Koşulları’na uygun kullanmayı kabul edersiniz. Hesap güvenliğinizden siz sorumlusunuz.</p>'.
                    '<h2>Platformun Hak ve Yükümlülükleri</h2><p>Platform, hizmetin sürekliliği için makul çabayı gösterir; teknik bakım, güncelleme ve güvenlik amacıyla hizmette değişiklik yapabilir.</p>'.
                    '<h2>Hesap Güvenliği</h2><p>Parolanızı gizli tutmalısınız. Hesabınızdan yapılan işlemlerden siz sorumlusunuz.</p>'.
                    '<h2>Oyunlar ve Kullanıcı İşlemleri</h2><p>Oyun sonuçları, puan ve istatistikler sunucu tarafından belirlenir ve kaydedilir. Adil oyun esastır.</p>'.
                    '<h2>Coin / Sanal Bakiye Sistemi</h2><p><strong>Coin, yalnızca platform içinde kullanılan sanal bir birimdir.</strong> Coin; ödüller, kampanyalar yoluyla kazanılabilir veya gerçek para ile satın alınabilir. Coin platform içinde kozmetik ürünler, turnuva/oyun katılımları ve mağaza işlemleri için harcanabilir. Bahis usulü oyunlarda platform, belirlenen oranda hizmet bedeli (komisyon) alabilir.</p>'.
                    '<p><strong>Coin gerçek paraya çevrilemez, geri ödenmez, nakde dönüştürülemez ve kullanıcılar arasında devredilemez/transfer edilemez.</strong> Coin bir yatırım aracı, elektronik para veya mevduat değildir ve herhangi bir kazanç garantisi içermez. Kazanılan coin’in tek kullanım alanı platform içi özelliklerdir.</p>'.
                    '<h2>Premium Üyelik</h2><p>Platform, süreli (ör. yıllık) ücretli bir Premium üyelik sunabilir. Premium; gelişmiş analiz, ek içerik ve kozmetik ayrıcalıklar gibi özellikler sağlar. Premium süresi sona erdiğinde üyelik otomatik olarak ücretsiz seviyeye döner. Fiyat ve kapsam Platform tarafından güncellenebilir; güncel bilgi üyelik ekranında yer alır.</p>'.
                    '<h2>Yasaklı Kullanımlar</h2><p>Hile, bot, çoklu hesap, manipülasyon ve güvenlik açığından yararlanma dâhil Kullanım Koşulları’nda sayılan yasaklı davranışlar geçerlidir.</p>'.
                    '<h2>Hesabın Askıya Alınması ve Sonlandırılması</h2><p>Sözleşme veya Kullanım Koşulları ihlalinde hesabınız askıya alınabilir veya sonlandırılabilir. Kötüye kullanım hâlinde ilgili sanal bakiye kısıtlanabilir.</p>'.
                    '<h2>Değişiklikler</h2><p>Bu sözleşme güncellenebilir. Önemli değişiklikler uygun yöntemlerle duyurulur.</p>'.
                    '<h2>Yürürlük</h2><p>Üyeliğinizi tamamladığınızda bu sözleşme yürürlüğe girer.</p>'.
                    '<h2>İletişim</h2><p>Sorularınız için: [E-POSTA].</p>',
            ],
        ];
    }
};
