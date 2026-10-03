# TavlaTV — Tasarım ve Kullanılabilirlik Denetim Raporu

| | |
|---|---|
| **Tarih** | 2026-10-03 |
| **Sürüm** | `package.json` 4.2.0 · commit `7c887d4` |
| **Kapsam** | Masaüstü, mobil tarayıcı, tablet ve kurulu PWA (standalone) görünümü |
| **Kod değişikliği** | 1. aşama (§1–§9): yok, yalnızca denetim. 2. aşama: 31 bulgunun düzeltme durumu §10'da. |
| **Kanıt klasörü** | [`docs/tasarim-denetim/`](docs/tasarim-denetim/) (29 ekran görüntüsü) |

---

## 1. Özet

### Sorun sayıları

| Önem | Adet |
|---|---|
| Kritik | 1 |
| Yüksek | 9 |
| Orta | 13 |
| Düşük | 8 |
| **Toplam doğrulanmış bulgu** | **31** |
| Estetik öneri (hata değil, ayrı listelendi) | 8 |
| Doğrulanamayan risk (kod incelemesinden) | 6 |

| Ortam | Bulgu sayısı (bir bulgu birden çok ortamı etkileyebilir) |
|---|---|
| Masaüstü | 17 |
| Mobil tarayıcı (telefon + tablet) | 29 |
| PWA (standalone emülasyonu) | 8 |

### En önemli bulgular

1. **TD-01 (Kritik):** "Yeni sürüm var" bandı oyun başlamadan önce çıktıysa oyun sırasında da ekranda kalıyor. Telefon yan çevrildiğinde tahtanın alt yarısını (7–12 numaralı haneler) kapatıyor ve bandın kapatma düğmesi yok.
2. **TD-02 (Yüksek):** Mobil üst çubuk 360–430 px'te taşıyor. 360 px'te "Giriş / Kayıt" düğmesi 34 px'e sıkışıyor ve metni okunmuyor. 390/430 px'te BETA rozeti düğme metninin üstüne biniyor, dil düğmesi sağdan kesiliyor.
3. **TD-03 (Yüksek):** Giriş formunda Enter'a (mobilde klavyedeki "Git" tuşuna) basınca giriş yapılmıyor. Bunun yerine Kayıt formu doğrulanıyor ve alanlar doluyken "Lütfen tüm alanları doldurun." uyarısı çıkıyor.
4. **TD-04 / TD-05 (Yüksek):** Sohbet paneli açıldığında masaüstü ve tablette tahtanın 1–4 numaralı hanelerini ve pul toplama tepsisini kapatıyor. Mobilde ise oyun içi sohbet tamamen gizli; telefonla oynayan kullanıcı online maçta mesaj yazamıyor.
5. **TD-06 (Yüksek):** Mobil dikey ekranda tahta küçük kalıyor. 360 px'te taşlar 19 px, nokta numaraları 9,7 px. Ekranın yaklaşık %45'i boş.
6. **TD-08 (Yüksek):** Ağ hatası "Şu an aktif turnuva yok." şeklinde boş liste gibi gösteriliyor. Bağlantı geri gelince liste kendiliğinden düzelmiyor ve uygulamanın genelinde bir çevrimdışı göstergesi yok.
7. **TD-07 (Yüksek):** "Hata Bildir" yüzen düğmesi mobilde mesajlaşmadaki "Gönder" düğmesinin, lider tablosundaki puan sütununun ve form alanlarının üstüne biniyor.

---

## 2. Test ortamı ve yöntem

### Çalıştırma

- **Frontend:** `vite build` ile production paketi üretildi ve `vite preview` ile `http://127.0.0.1:4173` adresinde sunuldu. Bu modda service worker gerçekten kayıt oluyor, yani PWA ve çevrimdışı davranışı üretime yakın.
- **Backend:** Laravel 12, `APP_ENV=e2e` ve ayrı bir sqlite veritabanıyla çalıştırıldı. Veritabanı `php artisan e2e:seed` ile kuruldu.
- **Test verisi:** Gerçekçi zorlayıcı durumlar için şunlar eklendi:
  - 12 kullanıcı; 15 karakterlik takma adlar (`Muhteşemoyuncu1`, `WWWWWWWWWWWWWWW`, `Burakcanaltınt6`).
  - 3 turnuva (açık, ücretsiz, bitmiş + eşleşme tablosu); uzun turnuva adı ("Kadıköy Belediyesi Geleneksel Büyük Sonbahar Tavla Şampiyonası 2026").
  - Uzun mesajlar (boşluksuz 80+ karakter, uzun URL), bildirimler, arkadaşlık isteği, makale/haber/etkinlik içerikleri.
- **Tarayıcı:** Playwright 1.62 + Chromium 141 (headless).
  - Mobil profillerde `isMobile`, `hasTouch`, DPR 2–3 ve Android Chrome kullanıcı ajanı kullanıldı.
  - iOS senaryolarında iPhone Safari kullanıcı ajanı kullanıldı, ancak **motor yine Chromium**.
- **Google Fonts:** Proxy sertifikası nedeniyle doğrudan yüklenemedi. Testte `curl` üzerinden aktarıldı, bu sayede gerçek yazı tipleri (Outfit vb.) ile ölçüm yapıldı.

### Ölçülen boyutlar

| Grup | Boyutlar |
|---|---|
| Masaüstü | 1280×720, 1366×768, 1440×900, 1920×1080 |
| Mobil dikey | 360×800, 390×844, 430×932 |
| Mobil yatay | 800×360, 844×390, 932×430 |
| Tablet | 768×1024 |
| PWA emülasyonu | iPhone dikey 390×844 (safe-area üst 47 / alt 34), iPhone yatay 844×390 (sol/sağ 47, alt 21), Android 412×915 |

### Otomatik tarama

75 rota × 11 boyut = **814 sayfa yüklemesi** yapıldı. Her yüklemede şunlar ölçüldü:

- Yatay kaydırma (`scrollWidth`).
- Ekran dışına taşan veya kesilen etkileşimli öğeler.
- `elementFromPoint` ile üstü kapalı düğmeler.
- 24 px altı dokunma hedefleri.
- 11 px altı yazılar.
- WCAG kontrast oranı.
- `text-overflow` ile kesilen metinler.
- Sabit (`fixed`/`sticky`) katmanlar.
- Konsol hataları.

Her yüklemenin ekran görüntüsü alındı ve rota başına 11 boyutu yan yana gösteren temas sayfalarıyla tek tek incelendi.

### Etkileşim testleri

Tarayıcıda gerçekten tıklanarak şunlar test edildi:

- **Navigasyon:** mobil çekmece menü (açma, grupları genişletme, kaydırma, ESC, Tab sırası), dil menüsü, tema değiştirme.
- **Formlar:** giriş, kayıt, şifremi unuttum, şifre sıfırlama (boş gönderim, hatalı giriş, Enter tuşu).
- **Oyun:** Yapay Zekâ'ya karşı oyun (11 boyutta); zar atma, oyun menüsü, sohbet paneli, Pes Et iletişim kutusu, oyun sırasında ekran yönü değişimi, arka plana alıp geri dönme (CDP `frozen`/`active`).
- **Oturum açmış kullanıcı:** bildirimler, mesajlar/sohbet (uzun mesaj), arkadaşlar, profil ve sekmeleri, turnuva listesi, turnuva lobisi ve eşleşme tablosu.
- **Modallar:** çerez bandı ve tercihler modalı, Hata Bildir modalı, üyelik modalı (yatay ekranda kaydırma).
- **Ağ durumları:** çevrimdışı ve yeniden bağlanma (`context.setOffline`, service worker etkin).
- **Bildirimler:** güncelleme bandı (yeni sürüm simülasyonu), Android kurulum istemi (`beforeinstallprompt` simülasyonu), iOS "Ana ekrana ekle" rehberi.
- **Geçersiz durumlar:** bilinmeyen URL, geçersiz izleme kodu.
- **Tema:** koyu tema (6 sayfa × masaüstü/mobil).

> **Önemli uyarı:** Tüm mobil, tablet ve PWA sonuçları **Chromium emülasyonudur**; gerçek cihaz testi değildir. Gerçek Android/iPhone, gerçek Safari (WebKit) ve gerçekten kurulmuş bir PWA kullanılamadı. Ayrıntılar §8'de.

---

## 3. Keşfedilen sayfalar ve durumlar (kontrol listesi)

**Durum sütunu:** ✅ test edildi, sorun yok · ⚠️ test edildi, bulgu var (ilgili TD numarası) · ⛔ test edilemedi

| Alan | Sayfa / durum | Durum |
|---|---|---|
| Ana sayfa | `/` misafir ve oturum açık; Oyun Arayanlar, Çevrimiçi Oyuncular, Canlı Maçlar, Top List, takvim, yükleniyor iskeleti | ⚠️ TD-02, TD-07, TD-31, E-1, E-2 |
| Giriş / kayıt | `/giris` (giriş + kayıt aynı sayfada), boş gönderim, hatalı giriş | ⚠️ TD-03, TD-25 |
| Şifre işlemleri | `/sifremi-unuttum`, `/sifre-sifirla?token=…` | ✅ |
| Google ile giriş | Düğme alanı | ⛔ Ortamda `GOOGLE_CLIENT_ID` yok; alan boş kaldı |
| Oyun kurulumu | `/yz-ile-oyna`, `/yeni-oyun`, `/arkadasinla-oyna`, `/tek-oyun` (oturum açık), bot seçimi | ⚠️ TD-16 |
| Tavla tahtası | Taşlar, zarlar, küp, skor, saatler, pip, oyun menüsü, Pes Et, sohbet; 11 boyut | ⚠️ TD-01, TD-04, TD-05, TD-06, TD-14, TD-15, TD-28 |
| Online maç (2 gerçek oyuncu) | Rakip hamlesi, bağlantı kopması sırasında oyun | ⛔ İki istemcili gerçek zamanlı maç kurulamadı (§8) |
| Lobi / oyuncu listesi | Çevrimiçi oyuncular, oyun arayanlar (boş ve dolu) | ✅ (boş durum: E-1) |
| Davetler / bildirimler | Bildirimler (Mesajlar sekmesinde birleşik), arkadaşlık isteği | ⚠️ TD-29 |
| Sohbet / mesajlar | `/mesajlar`, konuşma açık, uzun mesaj, uzun URL | ⚠️ TD-07 |
| Profil | `/profil`, `/profil/duzenle`, avatarlar, tahtalar, başarılar, pul tasarımları, adresler | ✅ (küçük hedefler TD-20) |
| Ayarlar | Tema, dil, oyun menüsü ayarları (pip, öğrenme modu, ses) | ⚠️ TD-23 |
| Turnuvalar | Liste, lobi/detay, katılımcılar, eşleşme tablosu, bitmiş turnuva, şampiyon | ⚠️ TD-08, TD-09, TD-10, E-4 |
| Turnuva takvimi, kulüpler | `/turnuva-takvimi`, `/kulupler` | ✅ |
| Lider tablosu | `/lider-tablosu` (Puan, Coin, WXP, PR) | ⚠️ TD-07, TD-22 |
| İçerik sayfaları | Makaleler/haberler (liste + detay), Tavla Rehberi (hub + yazı), magazin, SSS, nasıl oynanır, turnuva kuralları, dersler, bulmaca | ⚠️ TD-20 (breadcrumb, SSS arama) |
| Bilgi sayfaları | `/bilgi/*` (7 sekme), rütbeler | ⚠️ TD-21, TD-22 |
| Hukuki sayfalar | KVKK, çerez politikası | ✅ |
| Mağaza / üyelik | `/magaza`, `/urunler`, `/sepet`, üyelik modalı | ✅ (E-6) |
| Eğlence | Şans çarkı, zar slotu, bahane makinesi, Kız Tavlası | ⚠️ E-5 |
| Araçlar | Pozisyon analizi, mat analiz, hata günlüğü, maç analizleri | ✅ |
| İzleme | `/izle/<kod>` (geçersiz kod) | ⚠️ TD-11 |
| Bilinmeyen URL | `/yok-boyle-sayfa` | ⚠️ TD-27 |
| Modallar | Çerez bandı ve tercihleri, Hata Bildir, üyelik, Pes Et | ⚠️ TD-26 |
| Açılır menüler | Dil menüsü, mobil çekmece, oyun menüsü | ⚠️ TD-19, TD-24 |
| Durumlar | Yükleniyor, boş liste, uzun metin, çevrimdışı/yeniden bağlanma | ⚠️ TD-08, TD-10, TD-11 |
| Tema | Açık / koyu | ⚠️ TD-22, TD-23 |
| PWA | Standalone, safe-area, ikon, kurulum istemi, güncelleme bandı, çevrimdışı | ⚠️ TD-01, TD-13, TD-17, TD-18 (bkz. §5.3) |

---

## 4. Bulgular — öncelik sırasına göre

> **Kısaltmalar:** M = mobil tarayıcı, D = masaüstü, T = tablet, P = PWA (standalone emülasyonu).
> **Tarayıcı:** Aksi belirtilmedikçe Chromium 141 (Playwright); mobilde Android Chrome kullanıcı ajanı ve dokunmatik emülasyonu.

---

### KRİTİK

#### TD-01 — Güncelleme bandı oyun sırasında kalıyor, yatay ekranda tahtayı kapatıyor; kapatılamıyor
- **Önem:** Kritik
- **Ortam:** Mobil (D'de de görünür kalıyor). PWA'da güncelleme güvenli anda otomatik uygulandığından risk daha düşük.
- **Sayfa/bileşen:** Oyun ekranı + `UpdateBanner`
- **Test edilen boyut:** 390×844 → 844×390 (dönüş); 390×844 dikey
- **Tekrar üretme:**
  1. Ana sayfayı aç.
  2. Yeni bir frontend sürümü yayınlansın. Testte `/index.html?_v=*` yanıtı farklı bir `index-*.js` hash'i döndürecek şekilde ayarlandı.
  3. "Sitenin yeni sürümü var" bandı göründükten sonra *YZ ile Oyna → Başla* ile oyuna gir.
  4. Telefonu yatay çevir.
- **Beklenen:** Kod yorumuna göre band aktif maç sırasında gösterilmemeli; gösterilse bile kapatılabilmeli ve oyun alanını örtmemeli.
- **Mevcut durum:**
  - Band oyunda da kalıyor (`.update-banner` + `.app.game-view` aynı anda mevcut).
  - 844×390'da band `[211,312 → 633,374]` alanını kaplıyor: alt quadrant'taki 7–12 numaralı haneler, alt pip sayısı ve nokta numaraları örtülüyor.
  - Bandın kapatma veya "sonra" düğmesi yok. Kullanıcının tek seçeneği maç ortasında "Güncelle" (sayfayı yenileme).
- **Kanıt:** [05-guncelleme-bandi-yatay-oyun.png](docs/tasarim-denetim/05-guncelleme-bandi-yatay-oyun.png)
- **İlgili dosya:**
  - `src/autoUpdate.ts`: `maybeNotify` yalnız ilk gösterimi `unsafeToPrompt()` ile erteliyor; `notified=true` olduktan sonra band hiç gizlenmiyor.
  - `src/ui/UpdateBanner.tsx`: `show` bir kez `true` olunca kalıcı.
- **Öneri:**
  - `UpdateBanner`, oyun görünümüne girildiğinde kendini gizlesin; `unsafeToPrompt()` periyodik kontrolüyle `show=false` yapılabilir.
  - "Sonra" / kapat düğmesi eklensin.
  - Oyun dışında bile kompakt (tek satır) ve üst kenarda konumlansın.

---

### YÜKSEK

#### TD-02 — Mobil üst çubuk taşıyor: "Giriş / Kayıt" okunmuyor, BETA rozeti düğmeyi örtüyor, dil düğmesi kesiliyor
- **Önem:** Yüksek
- **Ortam:** M (360, 390, 430 dikey)
- **Sayfa/bileşen:** Tüm lobi sayfalarındaki üst çubuk (`.account-bar`, `.ab-beta`, dil düğmesi, `.acct-trigger`)
- **Tekrar üretme:** Herhangi bir sayfayı 360×800, 390×844 veya 430×932'de misafir olarak aç.
- **Beklenen:** Logo, giriş düğmesi, tema ve dil kontrolleri tam görünür, okunur ve çakışmasız olmalı.
- **Mevcut durum:**
  - **360 px:** "Giriş / Kayıt" düğmesi 34 px genişliğe sıkışıyor (`scrollWidth 49 > clientWidth 32`). Metin düğmeden taşıyor ve beyaz zeminde kayboluyor ("Giriş / Ka").
  - **390 / 430 px:** BETA 4.2 rozeti (`.ab-beta`, `left:100%` ile logonun sağına asılı) "Giriş / Kayıt" metninin üstüne biniyor.
  - **390 px:** Dil düğmesinin sağ kenarı 394 px'te, yani ekranın 4 px dışında.
  - **360 px, oturum açık:** Hesap düğmesinin (avatar) sağ kenarı 363 px'te.
  - `overflow-x:hidden` bu taşmayı gizlediği için yatay kaydırma oluşmuyor; içerik sessizce kesiliyor.
- **Kanıt:** [01-ust-cubuk-360.png](docs/tasarim-denetim/01-ust-cubuk-360.png), [02-ust-cubuk-390.png](docs/tasarim-denetim/02-ust-cubuk-390.png), [26-giris-360.png](docs/tasarim-denetim/26-giris-360.png)
- **İlgili dosya:** `src/App.css` `.ab-beta` (≈10262–10287), `.account-bar` mobil kuralları (≈10575–10620, `flex-wrap:nowrap`), `.acct-trigger` (≈9914)
- **Öneri:**
  - ≤430 px'te BETA rozetini logonun içine veya altına al ya da gizle.
  - Giriş düğmesine `flex-shrink:0` ve `min-width:max-content` ver; tema/bayrak/dil kontrollerinden birini menüye taşı.
  - Playwright'a "her görünür etkileşimli öğenin sağ kenarı ≤ innerWidth" assertion'ı ekle.

#### TD-03 — Giriş formunda Enter tuşu giriş yapmıyor, kayıt doğrulamasını tetikliyor
- **Önem:** Yüksek
- **Ortam:** M, D
- **Sayfa/bileşen:** `/giris` (`Auth.tsx`)
- **Test edilen boyut:** 390×844 (masaüstünde de aynı form yapısı)
- **Tekrar üretme:**
  1. `/giris` aç.
  2. "E-posta veya Takma İsim" ve "Şifre" alanlarını doldur.
  3. Şifre alanında Enter'a bas (mobilde klavyedeki "Git" tuşu).
- **Beklenen:** Giriş isteği gönderilmeli. Hatalıysa "E-posta/takma isim veya şifre hatalı" görünmeli.
- **Mevcut durum:**
  - Giriş yapılmıyor; sayfanın üstünde **"Lütfen tüm alanları doldurun."** uyarısı çıkıyor. Bu, Kayıt formunun doğrulaması.
  - Giriş alanları doluyken bu mesaj kullanıcıyı yanıltıyor.
  - Giriş yalnızca "Giriş Yap" düğmesine tıklanınca çalışıyor.
- **Kanıt:** [08-giris-enter-kayit-dogrulamasi.png](docs/tasarim-denetim/08-giris-enter-kayit-dogrulamasi.png)
- **İlgili dosya:** `src/ui/Auth.tsx` ≈548–663. Tek `<form onSubmit={…doRegister}>` var; "Giriş Yap" düğmesi `type="button"` ve `onClick={doLogin}`.
- **Öneri:** Giriş ve kaydı iki ayrı `<form>` yap; giriş formu `onSubmit={doLogin}` ve `type="submit"` kullansın. Ayrı form mümkün değilse giriş alanlarında `onKeyDown` Enter → `doLogin`.

#### TD-04 — Açılan sohbet paneli tahtayı ve pul toplama tepsisini kapatıyor
- **Önem:** Yüksek
- **Ortam:** D (1280, 1366, 1440, 1920), T (768)
- **Sayfa/bileşen:** Oyun ekranı, `.chat-panel`
- **Tekrar üretme:**
  1. YZ ile Oyna → Başla.
  2. Sağ alttaki "Sohbet" başlığına tıklayıp paneli aç.
- **Beklenen:** Panel tahtanın yanında ayrı bir sütunda açılmalı; en azından oyun alanını örtmemeli.
- **Mevcut durum:**
  - Panel `position:fixed; right:16px; bottom:16px; width:260px` ile açılıyor.
  - 1280×720'de `[1004,387 → 1264,704]` alanını kaplıyor; tahtanın 1–3 numaralı haneleri ve pul toplama tepsisi altında kalıyor.
  - 768×1024'te `[492,691 → 752,1008]`; 1–5 numaralı haneler örtülüyor.
  - Rakip mesaj yazarken hamle yapılacak taşlar görünmüyor; oyun sonunda pul toplama alanına erişilemiyor.
- **Kanıt:** [13-sohbet-tahtayi-kapatiyor-1280.png](docs/tasarim-denetim/13-sohbet-tahtayi-kapatiyor-1280.png), [14-sohbet-tahtayi-kapatiyor-768.png](docs/tasarim-denetim/14-sohbet-tahtayi-kapatiyor-768.png)
- **İlgili dosya:** `src/App.css` `.chat-panel` (≈25134–25385), `src/ui/Chat.tsx`
- **Öneri:** Geniş ekranda sohbeti tahtanın sağında grid sütunu olarak yerleştir (tahta `--board-h` hesabına dahil). Daha dar ekranlarda tam ekran alt sayfa (bottom sheet) olarak aç ve açıkken tahtayı karartma.

#### TD-05 — Mobilde oyun içi sohbet tamamen erişilemez
- **Önem:** Yüksek
- **Ortam:** M (≤720 px genişlik, tüm dikey telefonlar), M yatay (yükseklik ≤500 px), P
- **Sayfa/bileşen:** Online oyun ekranı, `Chat`
- **Tekrar üretme:**
  1. 390×844 veya 844×390'da bir oyuna gir.
  2. Sohbet başlığını veya düğmesini ara.
  3. Oyun menüsünü aç.
- **Beklenen:** Mobilde sohbete ulaşılabilecek bir giriş noktası olmalı (ikon, menü öğesi, alt sayfa).
- **Mevcut durum:**
  - `.chat-panel` iki medya sorgusunda `display:none`.
  - Oyun menüsünde de sohbet öğesi yok (menü: Pip, Öğrenme Modu, Canlı PR, Animasyonlar, Ses, Lobi, Pes Et).
  - Telefonla oynayan kullanıcı online maçta ne mesaj yazabiliyor ne de rakibin mesajını görebiliyor; okunmamış mesaj sayacı da görünmüyor.
- **İlgili dosya:** `src/App.css` ≈25374–25385 (`@media (max-width:720px)` ve `(orientation:landscape) and (max-height:500px)` → `.chat-panel{display:none}`), `src/App.tsx` ≈10277
- **Öneri:** Mobilde oyun menüsüne veya üst köşeye okunmamış sayaçlı bir sohbet düğmesi ekle; açıldığında tam ekran bir sayfa veya alt sayfa göster (TD-04 ile aynı bileşen).

#### TD-06 — Mobil dikey ekranda tahta çok küçük: taşlar 19–24 px, numaralar 11 px altı
- **Önem:** Yüksek
- **Ortam:** M dikey (360, 390, 430), P dikey
- **Sayfa/bileşen:** Oyun ekranı (`.board`, `.checker`, `.pt-numbers`, `.board-dice`)
- **Tekrar üretme:** 360×800'de YZ ile Oyna → Başla → Zar At.
- **Beklenen:** Taşlar parmakla rahat seçilebilmeli (≥32–44 px); numaralar okunabilmeli; ekran alanı tahtaya ayrılmalı.
- **Mevcut durum:**
  - Taş çapları: **360 → 19 px**, 390 → 21 px, 430 → 24 px.
  - Nokta numaraları: 360 → 9,7 px, 390 → 10,7 px.
  - Zarlar yaklaşık 16 px.
  - 360×800'de tahta yalnızca y≈385–640 aralığında; üstte (~180 px) ve altta (~160 px) boş lacivert alan var.
  - Uygulama "telefonunu yan çevir" uyarısı veriyor ama dikey düzen ekranı verimli kullanmıyor.
- **Kanıt:** [15-oyun-360-dikey.png](docs/tasarim-denetim/15-oyun-360-dikey.png), [21-pwa-ios-dikey-oyun.png](docs/tasarim-denetim/21-pwa-ios-dikey-oyun.png)
- **İlgili dosya:** `src/App.css` mobil `--board-h` hesapları (≈8519–8531 `@media (max-width:900px)`, ≈8690–8700); oyuncu kartı ve saat bloğu yerleşimi (`.player-card`, `.clock-stack`).
- **Öneri:**
  - Dikeyde oyuncu kartlarını ve saatleri tek kompakt satıra indir.
  - Tahtayı kalan yüksekliğe göre büyüt: `--board-h`'yi genişlik yerine `100dvh − üst/alt bloklar` ile sınırla. Gerekirse pul toplama tepsisini tahtanın altına al.
  - Taşa dokunma alanını görselden bağımsız olarak hane genişliği kadar büyüt.

#### TD-07 — "Hata Bildir" yüzen düğmesi içerik ve aksiyonların üstüne biniyor
- **Önem:** Yüksek
- **Ortam:** M, T, M yatay, D (1280/1366)
- **Sayfa/bileşen:** `.bug-fab` (mobilde sağ altta, ≥721 px'te sağ kenarda dikey sekme)
- **Tekrar üretme:**
  - `/mesajlar` → bir konuşma aç (360/390/768): "Gönder" düğmesinin sağ üstüne bak.
  - `/lider-tablosu` 360×800: 8. satırdaki puan sütununa bak.
  - `/giris` 360×800: "Soyad" alanının sağına bak.
  - `/online-turnuvalar` 768×1024 ve yatay telefon: kartın sağ kenarına bak.
- **Beklenen:** Yüzen düğme birincil aksiyonları ve veri sütunlarını örtmemeli.
- **Mevcut durum:**
  - "Gönder" `[292,698 → 334,740]`, FAB `[316,672 → 360,716]` (360 px). FAB üstte olduğu için Gönder'in sağ yarısına dokunmak Hata Bildir'i açıyor; 390 ve 768 px'te de çakışma var.
  - Lider tablosunda puan değerleri ("15…"), girişte form alanının sağ kenarı, turnuva kartında sağ üst köşe ve Canlı Maçlar filtre çipleri (yatay) altında kalıyor.
- **Kanıt:** [17-mesaj-gonder-fab-390.png](docs/tasarim-denetim/17-mesaj-gonder-fab-390.png), [25-lider-tablosu-fab-360.png](docs/tasarim-denetim/25-lider-tablosu-fab-360.png), [26-giris-360.png](docs/tasarim-denetim/26-giris-360.png), [11-turnuva-karti-768.png](docs/tasarim-denetim/11-turnuva-karti-768.png)
- **İlgili dosya:** `src/ui/bugReport.css` (`.bug-fab` ≈5–60), `src/ui/BugReport.tsx`
- **Öneri:** Mobilde FAB'ı kaldırıp Hata Bildir'i çekmece menüsüne ve üst çubuktaki bayrak ikonuna taşı (bayrak ikonu zaten 390/430'da var). Kalacaksa sohbet, form ve tablo sayfalarında gizle ya da içerik alanına `padding-bottom/right` ile pay bırak.

#### TD-08 — Ağ hatası boş liste olarak gösteriliyor; bağlantı dönünce düzelmiyor; çevrimdışı göstergesi yok
- **Önem:** Yüksek
- **Ortam:** M, D, P (aynı kod yolu; 390×844'te test edildi)
- **Sayfa/bileşen:** Turnuva listesi (`Tournaments.tsx`), lider tablosu, genel uygulama kabuğu
- **Tekrar üretme:**
  1. Siteyi aç (service worker kurulsun).
  2. Bağlantıyı kes.
  3. Menüden *Liderlik Tablosu*'nu, sonra `/online-turnuvalar`'ı aç.
  4. Bağlantıyı geri aç ve 6 sn bekle.
- **Beklenen:**
  - "Bağlantı yok" uyarısı ve "Tekrar dene" düğmesi.
  - Bağlantı dönünce listenin otomatik yenilenmesi.
  - Uygulama genelinde bir çevrimdışı şeridi.
- **Mevcut durum:**
  - Turnuva sayfası **"Şu an aktif turnuva yok."** diyor (veritabanında 2 açık turnuva var). Bu yanlış bir boş durum.
  - Bağlantı geri geldikten sonra da aynı mesaj kalıyor; yenileme veya yeniden deneme yok.
  - Lider tablosu "Liderlik tablosu yüklenemedi." diyor ama tekrar dene düğmesi yok.
  - Uygulamanın hiçbir yerinde çevrimdışı göstergesi yok (kodda `navigator.onLine` / `online` olayı dinlenmiyor).
- **Kanıt:** [18-baglanti-sonrasi-bos-turnuva.png](docs/tasarim-denetim/18-baglanti-sonrasi-bos-turnuva.png), [28-cevrimdisi-lider-tablosu.png](docs/tasarim-denetim/28-cevrimdisi-lider-tablosu.png)
- **İlgili dosya:** `src/ui/Tournaments.tsx` ≈134–142 (`refreshList` hatayı `catch {}` ile yutuyor, `list=[]` kalıyor) ve ≈1136–1142 (`tourn.empty`); lider tablosu bileşeni; `src/main.tsx` (genel çevrimdışı şeridi yok).
- **Öneri:**
  - Liste bileşenlerinde `error` durumunu `empty`'den ayır; "Tekrar dene" düğmesi ekle.
  - `window.addEventListener('online', refetch)` ile otomatik yenile.
  - Kök seviyede `navigator.onLine`'a bağlı ince bir "Çevrimdışısın" şeridi göster.

#### TD-09 — Turnuva kartlarında rozetler üst üste biniyor
- **Önem:** Yüksek
- **Ortam:** M (360), T (768), M yatay
- **Sayfa/bileşen:** `/online-turnuvalar` kartı (`.tourn-row`, `.tourn-fee`, `.tourn-players`)
- **Tekrar üretme:** `/online-turnuvalar`'ı 360×800 ve 768×1024'te aç; ilk kartın üst satırına bak.
- **Beklenen:** Tarih, "Online", durum, erişim, katılımcı sayısı ve giriş ücreti ayrı ayrı okunmalı.
- **Mevcut durum:**
  - **360 px:** Giriş ücreti hapı ("🎟 100") "● KAYIT AÇIK" rozetinin üstüne biniyor.
  - **768 px:** Aynı hap "KATILIMCILAR" etiketinin üstüne biniyor, doluluk çubuğu bilet ikonunun üstünden geçiyor. "5/8" sayısı ikonundan ve etiketinden kopuk duruyor.
- **Kanıt:** [10-turnuva-karti-360.png](docs/tasarim-denetim/10-turnuva-karti-360.png), [11-turnuva-karti-768.png](docs/tasarim-denetim/11-turnuva-karti-768.png)
- **İlgili dosya:** `src/ui/Tournaments.tsx` ≈1000–1060; `src/App.css` `.tourn-fee` (≈18656, ≈18870 mutlak konum), `.tourn-players` (≈18738, ≈18850), `.tourn-plabel` (≈18762)
- **Öneri:** `.tourn-fee`'yi mutlak konumdan çıkarıp rozet satırına (flex-wrap) akış öğesi olarak ekle. Katılımcı bloğunu ikon + sayı + etiket + çubuk şeklinde tek kapsayıcıda topla.

#### TD-10 — Turnuva lobisinde katılımcı adları 360 px'te okunamıyor
- **Önem:** Yüksek
- **Ortam:** M (360 dikey; 390'da da kısmen)
- **Sayfa/bileşen:** Turnuva detayı → "Katılımcılar" ızgarası (`.player-id-name-text`)
- **Tekrar üretme:** `/online-turnuvalar/eylul-kupasi-3`'ü 360×800'de aç ve Katılımcılar'a kaydır.
- **Beklenen:** Takma adlar (en çok 15 karakter) okunabilmeli.
- **Mevcut durum:**
  - İki sütunlu ızgarada ad alanı **34 px** genişliğe düşüyor.
  - "Ayşe0" → "Ayş…", "Mehmet1" → "Me…", "Muhteşemoyuncu1" → "Mu…", "WWWWWWWWWWWWWWW" → "W…".
  - Puan ve rütbe sütunları alanı paylaşıyor.
- **Kanıt:** [12-turnuva-lobisi-360.png](docs/tasarim-denetim/12-turnuva-lobisi-360.png)
- **İlgili dosya:** `src/ui/Tournaments.tsx` katılımcı listesi (`.tm-*`, `PlayerIdentity`), `src/App.css` `.tm-name` (≈23438)
- **Öneri:** ≤430 px'te ızgarayı tek sütuna indir; puanı ad satırının altına taşı. Ada `min-width: 8ch` ver.

---

### ORTA

#### TD-11 — Geçersiz veya bitmiş maç izleme bağlantısı sonsuza kadar "Yükleniyor…" gösteriyor
- **Önem:** Orta
- **Ortam:** M, D, T (tüm boyutlarda aynı)
- **Sayfa/bileşen:** `/izle/<kod>` (`Spectate.tsx`)
- **Tekrar üretme:** `/izle/ABCDEF`'i aç ve 15 sn bekle.
- **Beklenen:** "Maç bulunamadı veya sona erdi" mesajı ve "Canlı maçlara dön" düğmesi.
- **Mevcut durum:**
  - API 404 dönüyor; ekranda "● İzleniyor" rozeti, "0 kişi izliyor" ve dönen zarla "Yükleniyor…" kalıyor.
  - Kullanıcı hatayı anlayamıyor.
- **Kanıt:** [19-izle-sonsuz-yukleniyor.png](docs/tasarim-denetim/19-izle-sonsuz-yukleniyor.png)
- **İlgili dosya:** `src/ui/Spectate.tsx` ≈90–130 (`showRoom` hatası `catch {}` ile yutuluyor)
- **Öneri:** 404/410'da hata durumunu göster, polling'i durdur ve "İzleniyor" rozetini gizle.

#### TD-12 — 721–900 px genişlikte hamburger düğmesi logonun ilk harfini kapatıyor
- **Önem:** Orta
- **Ortam:** T (768), M yatay (800, 844, 932), P yatay
- **Sayfa/bileşen:** Üst çubuk (`.hamburger`, `.ab-brand`)
- **Tekrar üretme:** Herhangi bir sayfayı 844×390 veya 768×1024'te aç.
- **Beklenen:** Logo hamburgerin sağından başlamalı.
- **Mevcut durum:**
  - Hamburger `[0 → 52]`, logo `[25 → 154]`; logonun ilk "T" harfi hamburgerin altında kalıyor ("ΛVLATV").
  - Kök neden: hamburger `@media (max-width:900px)`'te görünür oluyor, ama logoya yer açan `padding-left: calc(64px + safe-area)` yalnızca `@media (max-width:720px)` içinde.
- **Kanıt:** [03-yatay-logo-hamburger-844.png](docs/tasarim-denetim/03-yatay-logo-hamburger-844.png), [04-pwa-ios-yatay-cekmece.png](docs/tasarim-denetim/04-pwa-ios-yatay-cekmece.png)
- **İlgili dosya:** `src/App.css` ≈9434–9452 (hamburger ≤900 px) ve ≈10575–10583 (`.account-bar` padding ≤720 px)
- **Öneri:** `.account-bar` sol padding kuralını 900 px kırılımına taşı (veya hamburgerle aynı medya sorgusunu kullan).

#### TD-13 — PWA (iPhone yatay): içerik ve kontroller sol/sağ safe-area'ya girmiyor (çentik altında kalıyor)
- **Önem:** Orta
- **Ortam:** P (iPhone yatay, safe-area sol/sağ 47 px emülasyonu)
- **Sayfa/bileşen:** Üst çubuk, mobil çekmece, lobi içerikleri, `.bug-fab`
- **Tekrar üretme:** Standalone + safe-area emülasyonunda 844×390'da ana sayfayı aç, sonra çekmeceyi aç.
- **Beklenen:** `viewport-fit=cover` kullanıldığı için içerik, çekmece öğeleri ve sabit düğmeler yatayda `env(safe-area-inset-left/right)` kadar içeriden başlamalı.
- **Mevcut durum:**
  - Hamburger `left: env(safe-area-inset-left)` ile içeri kaydırılmış, ama logo kaydırılmamış. Sonuç: logo çentiğin altında başlıyor ve hamburger logonun ortasına biniyor ("T [≡] ATV").
  - Çekmece öğeleri x=12'den başlıyor (çentik bölgesi).
  - Dil düğmesi `[777 → 819]` ve "Hata Bildir" sekmesi `[806 → 844]` sağ safe-area içinde.
  - Lobi kartları ekran kenarına (x=14) kadar uzanıyor.
- **Kanıt:** [04-pwa-ios-yatay-cekmece.png](docs/tasarim-denetim/04-pwa-ios-yatay-cekmece.png)
- **İlgili dosya:** `src/App.css` `.account-bar` (≈10575), `.side-menu` (≈682, ≈9454), `.lobby` içerik kapsayıcısı; `src/ui/bugReport.css`
- **Öneri:** Lobi kabuğu, üst çubuk ve çekmeceye `padding-left: max(…, env(safe-area-inset-left))` ve `padding-right: max(…, env(safe-area-inset-right))` ekle; `.bug-fab`'ın `right` değerine `env(safe-area-inset-right)` ekle.

#### TD-14 — Yatay oyunda üst oyuncunun adı soldan kesiliyor
- **Önem:** Orta
- **Ortam:** M yatay (800, 844, 932), P yatay
- **Sayfa/bileşen:** Oyun ekranı sol kenar çubuğu (`.player-name`)
- **Tekrar üretme:** 844×390'da YZ ile Oyna → Başla.
- **Beklenen:** "Seviye 1 · Neural AI" tam veya üç noktayla kısaltılmış görünmeli.
- **Mevcut durum:** Ad ortalanmış ve sütundan geniş olduğu için iki yana taşıyor. Sol kenarda "S" kesiliyor ("eviye 1 · Neural AI"); sağda saat bloğuna dayanıyor.
- **Kanıt:** [16-oyun-yatay-isim-kesik.png](docs/tasarim-denetim/16-oyun-yatay-isim-kesik.png), [29-pwa-ios-yatay-oyun.png](docs/tasarim-denetim/29-pwa-ios-yatay-oyun.png)
- **İlgili dosya:** `src/App.css` `.main.game-scene .player-name` (≈5734, ≈5973), `src/ui/landscapePhone.css`
- **Öneri:** `.player-name`'e `max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` ver veya iki satıra izin ver; sidebar sütununa `min-width:0` ver.

#### TD-15 — Oyun içi hamburger düğmesi pul toplama tepsisinin üstünde
- **Önem:** Orta
- **Ortam:** M dikey, T (768), P dikey
- **Sayfa/bileşen:** `.game-ham`
- **Tekrar üretme:** 390×844 veya 768×1024'te oyuna gir.
- **Beklenen:** Menü düğmesi oyun yüzeyinin dışında olmalı.
- **Mevcut durum:**
  - 390×844'te düğme `[346,403 → 384,441]`; tahta `[7 → 383]`, iç tahta `[7 → 330]`. Düğme sağdaki pul toplama tepsisinin (x 330–383) üst kısmını ve 24 numaralı hane hizasını örtüyor.
  - 768 px'te tepsinin ortasında duruyor. Oyun sonunda pul toplarken (bear-off) yanlış dokunma riski var.
- **Kanıt:** [15-oyun-360-dikey.png](docs/tasarim-denetim/15-oyun-360-dikey.png), [14-sohbet-tahtayi-kapatiyor-768.png](docs/tasarim-denetim/14-sohbet-tahtayi-kapatiyor-768.png)
- **İlgili dosya:** `src/App.css` `.game-ham` (≈9073–9105)
- **Öneri:** Dikey düzende düğmeyi üst sağdaki tam ekran düğmesinin yanına (tahtanın üstündeki boş alana) taşı.

#### TD-16 — Oyun kurulumunda "Başla" düğmesi ilk ekranda görünmüyor
- **Önem:** Orta
- **Ortam:** D (1280, 1366, 1440), M (tüm), T
- **Sayfa/bileşen:** `/yz-ile-oyna` (benzer düzen `/yeni-oyun`, `/arkadasinla-oyna`)
- **Tekrar üretme:** `/yz-ile-oyna`'yı aç, kaydırmadan "Başla"yı ara.
- **Beklenen:** Birincil aksiyon ilk ekranda veya yapışkan (sticky) bir alt çubukta görünmeli.
- **Mevcut durum:**
  - "Başla"nın üst kenarı: 1440×900'de y=963, 1366×768'de y=963, 1280×720'de y=963; mobilde y=1120–1166.
  - Kullanıcı 12 bot kartı, puan ve süre seçimlerini geçip aşağı kaydırmak zorunda; 1920×1080 dışında hiçbir boyutta ilk ekranda değil.
- **Kanıt:** [22-yz-ile-oyna-basla-ekran-disi-1440.png](docs/tasarim-denetim/22-yz-ile-oyna-basla-ekran-disi-1440.png)
- **İlgili dosya:** `src/ui/MatchSetup.tsx` / `src/ui/SetupBoard.tsx` kurulum kartı; `src/App.css` kurulum düzeni
- **Öneri:** "Başla"yı sticky alt çubuğa al (mobilde `bottom: env(safe-area-inset-bottom)`); masaüstünde sağdaki tahta önizlemesinin altına yerleştir.

#### TD-17 — iOS "Ana ekrana ekle" rehberinin karartma katmanı tam ekran yerine banner kutusuna hapsoluyor
- **Önem:** Orta
- **Ortam:** M (iPhone Safari kullanıcı ajanı emülasyonu)
- **Sayfa/bileşen:** `InstallPrompt` → iOS rehberi
- **Tekrar üretme:**
  1. iPhone Safari kullanıcı ajanıyla siteyi aç (kurulum istemi daha önce kapatılmamış olsun).
  2. Alttaki "TavlaTv'yi yükle" düğmesine dokun.
- **Beklenen:** Tüm ekranı karartan bir katman ve üstünde ortalanmış bir yönerge kartı.
- **Mevcut durum:**
  - Rehber `position:fixed; inset:0` ama `transform: translateX(-50%)` olan `.install-prompt`'un içinde. Bu yüzden fixed konum viewport'a değil banner'a göre hesaplanıyor: katman `[29,705 → 361,828]` alanıyla sınırlı.
  - Sayfa kararmıyor, kart banner'ın üstünden taşıyor ve arkadaki banner metni kartın altından görünüyor. Dışarı dokunarak kapatma yalnızca banner alanında çalışıyor.
- **Kanıt:** [07-ios-ana-ekrana-ekle-rehberi.png](docs/tasarim-denetim/07-ios-ana-ekrana-ekle-rehberi.png)
- **İlgili dosya:** `src/ui/InstallPrompt.tsx` ≈175–230
- **Öneri:** Rehberi `createPortal(…, document.body)` ile banner'ın dışına render et (veya banner'da `transform` yerine `left:0; right:0; margin:auto` kullan).

#### TD-18 — Kurulum istemi ile güncelleme bandı aynı noktada üst üste biniyor
- **Önem:** Orta
- **Ortam:** M (Android Chrome emülasyonu), D
- **Sayfa/bileşen:** `InstallPrompt` + `UpdateBanner`
- **Tekrar üretme:** `beforeinstallprompt` gelmiş ve yeni sürüm algılanmış bir oturumda ana sayfayı aç.
- **Beklenen:** Aynı anda tek bildirim veya alt alta yığılmış iki bildirim.
- **Mevcut durum:**
  - İkisi de `position:fixed; bottom: safe-area+16px; z-index:2147483000`. Kurulum istemi "Güncelle" düğmesini tamamen örtüyor.
  - Yarı saydam zeminden (0.96) arkadaki band metni okunuyor.
  - Kurulum isteminin kapat düğmesi 26×26 px.
- **Kanıt:** [06-kurulum-guncelleme-cakisma.png](docs/tasarim-denetim/06-kurulum-guncelleme-cakisma.png)
- **İlgili dosya:** `src/ui/InstallPrompt.tsx`, `src/ui/UpdateBanner.tsx`
- **Öneri:** Ortak bir bildirim yığını (toast stack) kullan veya güncelleme varken kurulum istemini ertele; kapat düğmesini ≥40 px yap.

#### TD-19 — Kapalı mobil çekmece ve oyun menüsü klavye odağı alıyor; ESC çekmeceyi kapatmıyor
- **Önem:** Orta (erişilebilirlik)
- **Ortam:** M, T, M yatay (çekmece); tüm boyutlar (oyun menüsü)
- **Sayfa/bileşen:** `aside.side-menu`, `.game-menu`
- **Tekrar üretme:**
  1. 360×800'de ana sayfada Tab'a 6 kez bas.
  2. Çekmeceyi aç ve ESC'ye bas.
- **Beklenen:** Ekran dışındaki menü `inert`/`aria-hidden` olmalı; ESC açık çekmeceyi kapatmalı.
- **Mevcut durum:**
  - Kapalı çekmecede `inert=false`, `aria-hidden` yok ve 14 odaklanabilir öğe var. 6. Tab'da odak x=-241'e (görünmez menüye) gidiyor.
  - Kapalı oyun menüsünün 8 düğmesi (Kapat, Pip…, Lobi, Pes Et) ekran dışında ama odaklanabilir.
  - ESC çekmeceyi kapatmıyor.
- **İlgili dosya:** `src/ui/SideMenu.tsx`, `src/ui/GameMenu.tsx`
- **Öneri:** Kapalıyken `inert` özniteliği ekle; açıkken odağı menüye taşı ve tuzakla (focus trap); ESC ile kapat.

#### TD-20 — Küçük dokunma hedefleri
- **Önem:** Orta
- **Ortam:** M, D, T
- **Sayfa/bileşen ve ölçümler:**

| Öğe | Ölçü | Sayfalar |
|---|---|---|
| Breadcrumb bağlantıları (`a.breadcrumb-link`) | 17–18 px yükseklik | Tavla Rehberi, makale/haber detay, turnuva detay, SSS, Bilgi sayfaları (196+ ölçüm) |
| SSS arama kutusu | 513×**20** px | `/sikca-sorulan-sorular` |
| Coin çipi (`.stat-chip-coin`) | 96×21 px | Oturum açık üst çubuk |
| Maç ID çipi | 110×21 px (mobilde 73×21) | Oyun ekranı |
| Oyun menüsü "Kapat" | 24×24 px | Oyun menüsü |
| İzleme ses düğmesi | 22×22 px | `/izle/*` |
| Kurulum istemi kapat | 26×26 px | Kurulum istemi |
| Mobil dikey tahtada taşlar | 19–24 px | TD-06 |

- **Tekrar üretme:** İlgili sayfayı aç ve öğenin `getBoundingClientRect()` değerini ölç.
- **Beklenen:** WCAG 2.2 en az 24×24 px; mobilde 40–44 px önerilir.
- **İlgili dosya:** `src/ui/Breadcrumb.tsx`, `src/ui/FaqView.tsx`, `src/ui/GameMenu.tsx`, `src/ui/Spectate.tsx`, `src/ui/InstallPrompt.tsx`
- **Öneri:** Breadcrumb bağlantılarına dikey padding (`padding-block:10px`), SSS arama kutusuna `min-height:44px`, ikon düğmelerine `min-width/min-height:40px` ver.

#### TD-21 — Çok küçük yazılar (11 px altı)
- **Önem:** Orta
- **Ortam:** M, D, T
- **Ölçülen örnekler:**

| Öğe | Boyut |
|---|---|
| `.ab-beta` (BETA 4.2) | 8–9 px |
| Menü grup başlıkları (`.menu-group-label`) | 10,56 px (735 ölçüm) |
| Turnuva tarih rozetinde ay (`.edb-month`) | 9,28 px |
| Turnuva kartında "KATILIMCILAR" (`.tourn-plabel`) | 9,9 px |
| Ana sayfa turnuva sayaç etiketleri (`.tr-count-lbl`, `.tr-cd-lbl`) | 9,6–10,56 px |
| Rozet alt metni (`.rb-sub`) | 9,28 px |
| Turnuva detay başlık etiketleri (`.th-lbl`) | 9,6 px |
| Oyun ekranı nokta numaraları | 9,7 px (360) / 10,7 px (390) |
| "Seviye 1 · Beginner" | ≈9 px |
| Sözlük içi tahta etiketleri | 7–8 px |

- **Beklenen:** Gövde ve etiket metinlerinde en az 12 px (büyük harf etiketlerde en az 11 px).
- **İlgili dosya:** `src/App.css` ilgili sınıflar (`.ab-beta` ≈10262, `.edb-month` ≈4789, `.tourn-plabel` ≈18762)
- **Öneri:** Etiketler için `--fs-label: max(11px, 0.72rem)` tasarım belirteci tanımla ve tüm mikro etiketleri ona bağla.

#### TD-22 — Açık temada yetersiz kontrast
- **Önem:** Orta
- **Ortam:** M, D, T
- **Ölçülen oranlar (WCAG AA: normal metin 4,5:1, büyük metin 3:1):**

| Öğe | Renk | Oran |
|---|---|---|
| "Premium" erişim rozeti (`.tourn-access-premium`) | #E6B422 bej/beyaz zemin üzerinde | **1,6–1,9:1** |
| Nadirlik etiketleri (`.rarity-title`, `.rarity-count`) | | 2,0–2,8:1 |
| Lider tablosu galibiyet sayısı (`.lb-win`) | | 2,78:1 |
| Başarım grup başlığı "Yaygın" | | 3,13:1 |
| "Kayıt açık" (`.tr-status-open`, 10,56 px) | #3F9E6A beyaz üzerinde | 3,33:1 |
| Rütbe kodu (`.rank-prog__code` G3) | | 3,32:1 |

- **İlgili dosya:** `src/App.css` ilgili sınıflar
- **Öneri:** Sarı rozete koyu metin (#5C4300) ya da koyu zemin ver; yeşil durum metni için #1F7A4D gibi daha koyu bir ton kullan; nadirlik renklerini koyulaştır.

#### TD-23 — Koyu temada vurgu rengiyle kontrast hatası
- **Önem:** Orta
- **Ortam:** M, D (koyu tema)
- **Sayfa/bileşen:** Koyu tema genelinde vurgu rengi `--accent` (#C9563F)
- **Tekrar üretme:** Tema düğmesiyle koyu temaya geç; ana sayfa, turnuvalar, lider tablosu, mağaza ve sözlüğü aç.
- **Mevcut durum:**
  - Vurgu rengi **metin** olarak koyu zeminde: 3,07–4,04:1. Örnekler: turnuva sayacı, "Online", "100"/"Ücretsiz", lider puanı, "Satın Al", sözlük bağlantıları.
  - **Zemin** olarak üzerinde açık metin: 3,83:1 ("Giriş / Kayıt", "Tümü", "Hata Bildir" sekmesi), 4,3:1 (beyaz BETA, takvim günü, "EN POPÜLER" 9,6 px).
- **Kanıt:** [27-koyu-tema-ana-sayfa-390.png](docs/tasarim-denetim/27-koyu-tema-ana-sayfa-390.png)
- **İlgili dosya:** `src/App.css` ≈156 (`--accent: var(--coral)` koyu tema), ≈14 (`--med-terracotta: #c9563f`)
- **Öneri:** Koyu temada iki ayrı belirteç tanımla:
  - Metin için daha açık vurgu (ör. #E07A63, koyu zeminde ≥4,5:1).
  - Düğme zemini için daha koyu vurgu (ör. #A83A2B; beyaz metinle ≈6:1).

---

### DÜŞÜK

#### TD-24 — Çekmece kaydırılınca içerik sabit hamburgerin altına giriyor
- **Önem:** Düşük
- **Ortam:** M (360, 390, 430 dikey)
- **Tekrar üretme:** Çekmeceyi aç, tüm grupları genişlet, aşağı kaydır.
- **Mevcut durum:** Sabit hamburger (z-index 110) çekmecenin (z-index 106) üstünde kalıyor; "TURNUVALAR" başlığı "UVALAR" olarak kesiliyor.
- **Kanıt:** [20-cekmece-hamburger-cakisma.png](docs/tasarim-denetim/20-cekmece-hamburger-cakisma.png)
- **İlgili dosya:** `src/App.css` `.hamburger` (≈9038), `.side-menu` (≈9454)
- **Öneri:** Çekmece açıkken hamburgeri çekmecenin içine "kapat (×)" olarak taşı veya çekmece içeriğine `padding-top: 56px + safe-area` ver.

#### TD-25 — Giriş hatası iki kez gösteriliyor ve bildirim satır içi hatayı örtüyor
- **Önem:** Düşük
- **Ortam:** M, D
- **Tekrar üretme:** `/giris`'te hatalı bilgilerle "Giriş Yap"a tıkla.
- **Mevcut durum:** "E-posta/takma isim veya şifre hatalı." hem satır içi kutuda (`.auth-error-top`, y 79–120) hem de toast olarak (y 72–136) çıkıyor. Toast satır içi kutunun tam üstünde.
- **Kanıt:** [09-giris-cift-hata-mesaji.png](docs/tasarim-denetim/09-giris-cift-hata-mesaji.png)
- **İlgili dosya:** `src/ui/Auth.tsx` (`doLogin` hata yolu), `src/ui/Toast.tsx`
- **Öneri:** Form hatalarında yalnızca satır içi mesaj kullan (ilgili alanın yanında, `aria-live`).

#### TD-26 — Çerez bandı mobilde ekranın büyük bölümünü kaplıyor
- **Önem:** Düşük
- **Ortam:** M
- **Tekrar üretme:** İlk ziyarette 360×800 ve 844×390'da ana sayfayı aç.
- **Mevcut durum:** Band dikeyde ekranın **%41'ini** (331 px), yatay telefonda **%51'ini** kaplıyor.
- **Kanıt:** [24-cerez-bandi-360.png](docs/tasarim-denetim/24-cerez-bandi-360.png)
- **İlgili dosya:** `src/ui/cookieConsent.css`, `src/ui/CookieConsent.tsx`
- **Öneri:** Mobilde metni 2 satıra indir ("Ayrıntılar" bağlantısıyla); düğmeleri tek satırda iki düğme + metin bağlantısı yap.

#### TD-27 — Bilinmeyen URL'ler 404 göstermeden ana sayfaya düşüyor
- **Önem:** Düşük
- **Ortam:** M, D
- **Tekrar üretme:** `/yok-boyle-sayfa`'yı aç.
- **Mevcut durum:** URL sessizce `/` olarak yeniden yazılıyor ve ana sayfa gösteriliyor. Kullanıcı yanlış bağlantıyı fark etmiyor; arama motorları için "soft 404" oluşuyor.
- **İlgili dosya:** `src/App.tsx` `applyFromPath` `default:` dalı (≈1530) ve `currentSlug` → `replaceState('/')` (≈1555)
- **Öneri:** Tanınmayan rota için "Sayfa bulunamadı" görünümü göster ve URL'yi koru.
- **Sonradan düzeltme (doğrulama):** Bu davranış yalnızca test ortamındaki `vite preview` sunucusundan kaynaklanıyor. Üretimde Laravel `routes/web.php` içindeki `Route::fallback`, bilinmeyen ilk segmentler için 404 durum koduyla markalı bir hata sayfası (`errors.404`) döndürüyor. Bu nedenle üretim için bir hata değildir; kodda değişiklik yapılmadı (bkz. §10).

#### TD-28 — Oyun ekranının çevresinde krem renkli çerçeve
- **Önem:** Düşük
- **Ortam:** D, M, T, P
- **Tekrar üretme:** Herhangi bir boyutta oyuna gir.
- **Mevcut durum:** Koyu oyun sahnesinin üst/sol/sağ/alt kenarında 8–10 px'lik krem şerit var (`.app` padding'i body zeminini gösteriyor). PWA yatayda safe-area bölgeleri de krem kalıyor.
- **Kanıt:** [16-oyun-yatay-isim-kesik.png](docs/tasarim-denetim/16-oyun-yatay-isim-kesik.png), [29-pwa-ios-yatay-oyun.png](docs/tasarim-denetim/29-pwa-ios-yatay-oyun.png)
- **İlgili dosya:** `src/App.css` `.app` (≈669–679)
- **Öneri:** `.app.game-view` için zemini oyun sahnesiyle aynı koyu renge ayarla (veya body'ye `game-view` sınıfı ekle).

#### TD-29 — Okunmamış sayaçları tutarsız
- **Önem:** Düşük
- **Ortam:** D (1366)
- **Tekrar üretme:** Oturum açık kullanıcıyla `/mesajlar`'ı aç.
- **Mevcut durum:** Aynı anda üst çubukta sohbet ikonu **4**, Mesajlar sekmesi **3**, sol menüde Mesajlar **1** gösteriyor. Sayaçların neyi saydığı (bildirim, sohbet, istek) ayırt edilemiyor.
- **İlgili dosya:** `src/App.tsx` üst çubuk ve menü rozetleri, `src/ui/Messages.tsx`
- **Öneri:** Tek bir kaynaktan hesapla; farklı şeyler sayılıyorsa ikon veya etiketle ayır.

#### TD-30 — Tablette "telefonunu yan çevir" uyarısı
- **Önem:** Düşük
- **Ortam:** T (768×1024)
- **Mevcut durum:** Oyun ekranında "Daha iyi oynamak için telefonunu yan çevir 📱" uyarısı tablette de çıkıyor. Bu boyutta dikey tahta zaten yeterince büyük (taş 46 px).
- **Öneri:** Uyarıyı kısa kenarı 600 px'ten küçük cihazlarla sınırla; metni "cihazını" olarak genelleştir.

#### TD-31 — Kapalı çekmecenin gölgesi mobilde sol kenarda gri şerit oluşturuyor
- **Önem:** Düşük
- **Ortam:** M, T (çekmece modunun kullanıldığı tüm boyutlar)
- **Tekrar üretme:** 390×844'te herhangi bir sayfaya bak; sol kenardaki 0–20 px'e dikkat et.
- **Mevcut durum:** Kapalı `aside.side-menu`'nun sağ kenarı x=−5'te; `box-shadow: 6px 0 24px rgba(0,0,0,.4)` ekrana sızıyor ve tüm mobil sayfalarda sol kenarda gri bir gölge şeridi görünüyor.
- **Kanıt:** [23-ana-sayfa-390.png](docs/tasarim-denetim/23-ana-sayfa-390.png) (sol kenar)
- **İlgili dosya:** `src/App.css` `.side-menu` mobil kuralı (≈9454)
- **Öneri:** Gölgeyi yalnızca açık durumda uygula (`.side-menu.open { box-shadow: … }`) veya kapalıyken `visibility:hidden` yap.

---

## 5. Ortam bazlı ayrı değerlendirme

### 5.1 Masaüstü (1280×720, 1366×768, 1440×900, 1920×1080)

- **Sorunsuz olanlar:** Hiçbir sayfada yatay kaydırma yok. Sol menü, içerik ve footer düzeni tutarlı.
- **Bulgular (17):** TD-01, TD-03, TD-04 (sohbet tahtayı kapatıyor), TD-07 (1280/1366'da sağ kenar sekmesi içerik kenarına biniyor), TD-08, TD-11, TD-16 (Başla ekran dışında), TD-18, TD-19 (oyun menüsü odak), TD-20, TD-21, TD-22, TD-23, TD-25, TD-27, TD-28, TD-29.
- **1920×1080:** Oyun tahtası iyi ölçekleniyor (taş 84 px). Kız Tavlası ve turnuva eşleşme tablosu ekranı verimsiz kullanıyor (estetik: E-4, E-5).

### 5.2 Mobil tarayıcı (360/390/430 dikey ve yatay, 768 tablet)

- **En kritik alanlar:**
  - Üst çubuk (TD-02, TD-12)
  - Oyun ekranı (TD-01, TD-05, TD-06, TD-14, TD-15)
  - Turnuva bileşenleri (TD-09, TD-10)
  - Yüzen "Hata Bildir" düğmesi (TD-07)
  - Çevrimdışı durum (TD-08)
- **Formlar:** Giriş ve kayıt alanları 16 px yazı tipi kullanıyor (iOS'ta odaklanınca zoom yapmaz); `autocomplete` değerleri doğru (`username`, `current-password`, `new-password`, `email`, `tel-national`). Enter davranışı hatalı (TD-03).
- **Modallar:** Üyelik, çerez tercihleri, Hata Bildir ve Pes Et modalları dar ve yatay ekranlarda `overflow-y:auto` ile kaydırılabiliyor, kapatma düğmeleri görünür. Bu açıdan sorun bulunmadı.
- **Yön değişimi:** Oyun dikey → yatay → dikey dönüşünde tahta doğru yeniden ölçekleniyor (`board` 7–383 → 287–743 → 7–383). Bozulma yok; yalnızca TD-01 ve TD-14 görünür.
- **Arka plana alma:** CDP `frozen` → `active` sonrasında oyun durumu korunuyor.

### 5.3 Kurulu PWA (standalone) — emülasyon sonuçları

> Gerçek kurulum yapılamadı. Standalone görünüm şu şekilde emüle edildi:
> - `matchMedia('(display-mode: standalone)')` ve `navigator.standalone=true` ile; CSS `@media (display-mode)` kullanılmadığı için bu yeterli.
> - CDP `Emulation.setSafeAreaInsetsOverride` ile.
> - Tarayıcı araç çubuğu olmayan tam ekran yüksekliğiyle.
>
> Bu sonuçlar, mobil tarayıcı testinden ayrı tutulmuştur.

| Kontrol | Sonuç |
|---|---|
| Üst safe-area (çentik), dikey | ✅ Üst çubuk ve hamburger `env(safe-area-inset-top)` kadar aşağıdan başlıyor; içerik durum çubuğunun altına girmiyor. |
| Alt safe-area (hareket çubuğu) | ✅ FAB, güncelleme bandı ve kurulum istemi `env(safe-area-inset-bottom)` kullanıyor; kaydırılan içerik alt bölgeye taşabiliyor (beklenen). |
| Sol/sağ safe-area, yatay | ❌ TD-13 (içerik ve kontroller çentik altında), TD-12 (hamburger logonun üstünde) |
| 100vh / 100dvh | ✅ Ana kabuk `height:100dvh` + `overflow:hidden` ile iç kaydırma kullanıyor; standalone'da alt kesilme gözlenmedi. ⚠️ Mobil tahta hesabında `100vh` kalıntısı var (R-4). |
| Kaydırma davranışı | ✅ Lobi sayfaları iç kaydırıcıda kayıyor; çekmece açıkken `body` kilitleniyor. ⚠️ TD-24 |
| Oyun ekranı | ⚠️ TD-06 (dikeyde tahta küçük), TD-14, TD-28 (krem kenarlar); tahta safe-area içinde kalıyor. |
| Kurulum istemi standalone'da | ✅ Gizleniyor (`isStandalone()`); "TavlaTv'yi yükle" düğmesi kurulu uygulamada görünmüyor. |
| Uygulama içi gezinme (geri düğmesi yok) | ✅ Tüm sayfalarda hamburger menü ve logo (ana sayfa) var; içerik sayfalarında breadcrumb, tam ekran sayfalarda (Kız Tavlası, izleme) × düğmesi var. ⚠️ Mesajlar/Profil/Mağaza'da sayfa içi "geri" yok; iOS standalone'da kenardan kaydırarak geri dönme olmadığı için menüye bağımlılık var (öneri E-7). |
| Klavye açılması | ⛔ Emüle edilemedi (§8, R-1) |
| Arka plana alıp dönme | ✅ (CDP lifecycle emülasyonu) Oyun durumu korunuyor; görünürlük değişiminde güncelleme kontrolü tetikleniyor. |
| Yön değiştirme | ✅ Tahta yeniden ölçekleniyor; ❌ TD-13, TD-14 |
| Çevrimdışı / yeniden bağlanma | ✅ Service worker çevrimdışıyken uygulama kabuğunu ve gezinmeyi sunuyor. ❌ Veri hataları boş liste olarak görünüyor ve yeniden bağlanınca yenilenmiyor (TD-08). Genel çevrimdışı şeridi yok. |
| Güncelleme bildirimi | Standalone'da yeni sürüm güvenli anda otomatik uygulanıyor (band yerine yeniden yükleme). Tarayıcı modunda ❌ TD-01, TD-18. |
| Uygulama adı / ikon | ✅ `name`/`short_name` "TavlaTv", `display: standalone`. 192 ve 512 ikonları mevcut; maskable ikon %80 güvenli daire içinde (logo kırpılmıyor). ⚠️ `apple-touch-icon` için 192 px kullanılıyor (iOS 180 px bekler; ölçeklenir, kritik değil). |
| Açılış ekranı / tema rengi | ⚠️ `background_color: #1C1A17` (koyu) ama uygulamanın açık tema zemini krem (#F4EFE6): Android açılışında koyu → krem renk geçişi beklenir (R-3). `theme_color: #A83A2B` tek değer; koyu tema için ayrı `<meta name="theme-color" media="(prefers-color-scheme: dark)">` yok. |
| iOS durum çubuğu | ⚠️ `apple-mobile-web-app-status-bar-style: black-translucent` + beyaz üst çubuk → durum çubuğu simgeleri beyaz zemin üzerinde beyaz görünebilir (R-2, gerçek cihazda doğrulanmalı). |

**PWA'yı etkileyen bulgular (8):** TD-05, TD-06, TD-08, TD-12, TD-13, TD-14, TD-15, TD-28. (TD-01 standalone'da otomatik güncelleme nedeniyle büyük ölçüde oluşmaz; tarayıcı modunda geçerlidir.)

---

## 6. Estetik öneriler (doğrulanmış hata değil)

| No | Öneri | Nerede |
|---|---|---|
| E-1 | Boş "Çevrimiçi Oyuncular" kartı mobilde ~360 px yükseklikte boş kalıyor; boş durumda kartı içeriğe göre küçült veya tek satırlık bir boş durum göster. | Ana sayfa, 390×844 ([23](docs/tasarim-denetim/23-ana-sayfa-390.png)) |
| E-2 | Canlı Maçlar filtre çipleri 390 px'te 4+1 şeklinde kırılıyor ve "Turnuva" tek başına tam genişlik satıra düşüyor; tek satır yatay kaydırmalı çip dizisi daha düzenli olur. | Ana sayfa mobil |
| E-3 | Sol menüde aktif öğenin flama şekli menü kartının yuvarlak sağ kenarından dışarı taşıyor. | Masaüstü sol menü ([22](docs/tasarim-denetim/22-yz-ile-oyna-basla-ekran-disi-1440.png)) |
| E-4 | Turnuva eşleşme tablosunda sütunlar içerikten çok daha uzun (büyük gri boşluklar); mobilde yatay kaydırılabildiğine dair bir ipucu (gölge veya ok) yok. | Turnuva detayı |
| E-5 | Kız Tavlası masaüstünde tahta ekranın küçük bir bölümünü kullanıyor; "Çok Sıkıldım" paneli çok küçük kalıyor. | `/kiz-tavlasi` 1440/1920 |
| E-6 | Üyelik modalında yatay telefonda "Şimdi Abone Ol" ilk görünümde yok (kaydırılabiliyor); kaydırma ipucu veya yapışkan alt CTA eklenebilir. | Üyelik modalı 800×360 |
| E-7 | iOS standalone'da Mesajlar/Profil/Mağaza gibi tam sayfalara üstte "‹ Geri" bağlantısı eklemek gezinmeyi kolaylaştırır. | PWA |
| E-8 | Mobil hamburger düğmesinin beyaz zemini üst çubuğun altına taşıp "baloncuk" gibi görünüyor; kurulum istemi dar ekranda başlık 2 satır + açıklama 4 satır olacak şekilde sıkışıyor. | Mobil üst çubuk, kurulum istemi |

---

## 7. Doğrulanması gereken riskler (tarayıcıda kanıtlanamadı)

| No | Risk | Dayanak |
|---|---|---|
| R-1 | **Mobil klavye:** Kodda `visualViewport` takibi veya `interactive-widget` ayarı yok. iOS Safari ve PWA'da klavye açıldığında `100dvh` sabit kabuk içinde mesaj yazma alanı ve form düğmeleri klavyenin altında kalabilir ya da sayfa sıçrayabilir. | Kod taraması (`visualViewport` kullanımı yok). Gerçek cihazda Mesajlar, Giriş ve Hata Bildir formlarıyla test edilmeli. |
| R-2 | **iOS durum çubuğu:** `black-translucent` stili durum çubuğu metnini beyaz yapar; açık temada üst çubuk beyaz olduğu için saat ve pil simgeleri görünmeyebilir. | `index.html` meta etiketi + açık tema üst çubuk rengi |
| R-3 | **Açılış ekranı rengi:** Manifest `background_color` koyu, uygulama açık. Android'de açılışta koyu → krem renk geçişi oluşabilir. | `public/manifest.webmanifest` |
| R-4 | **Mobil Safari'de `100vh`:** `@media (max-width:900px)` altındaki `--board-h` hesabı `100vh` kullanıyor. Safari araç çubukları görünürken tahta beklenenden yüksek hesaplanıp alt kenardan kesilebilir. | `src/App.css` ≈8527 |
| R-5 | **WebKit render farkları:** Tüm testler Chromium ile yapıldı. `backdrop-filter`, `clip-path` ile çizilen aktif menü flaması ve `color()` fonksiyonlu renkler Safari'de farklı görünebilir. | — |
| R-6 | **Online maçta bağlantı kopması:** İki istemcili gerçek maçta rakip veya kendi bağlantı kopması ekranı test edilemedi (i18n'de `mp.moveConnLost` gibi metinler var). | — |

---

## 8. Test edilemeyen alanlar ve eksik erişimler

- **Gerçek cihaz yok:** Android telefon, iPhone ve tablet fiziksel olarak test edilmedi. Tüm mobil sonuçlar Chromium cihaz emülasyonudur (dokunma, DPR, kullanıcı ajanı).
- **Gerçek Safari / WebKit yok:** Ortamda yalnızca Chromium kurulu. "iPhone/Safari" senaryoları yalnızca kullanıcı ajanı ve safe-area emülasyonudur; WebKit render ve davranış farkları (R-5) doğrulanamadı.
- **Kurulu PWA yok:** Headless Chromium'da PWA gerçekten kurulamaz. Standalone görünüm `matchMedia`, safe-area ve tam ekran yüksekliğiyle emüle edildi. Açılış (splash) ekranı, ana ekran ikonunun cihazdaki görünümü, gerçek arka plana alma/dönme ve sistem geri hareketi doğrulanamadı.
- **Mobil klavye:** Sanal klavye emüle edilemez; klavyenin sohbet ve form alanlarını kapatıp kapatmadığı test edilemedi (R-1).
- **İki oyunculu gerçek zamanlı maç:** Online eşleşme, rakip hamlesi animasyonu, maç içi bağlantı kopması ve oyun sonu ekranı (MatchResult) uçtan uca test edilmedi; yapay zekâ maçında ilk zar ve oyun içi menüler test edildi.
- **Devam eden turnuva maçı:** "running" durumundaki turnuva eşleşme ekranı ve canlı skorlar test edilmedi (açık ve bitmiş turnuvalar test edildi).
- **Google ile giriş:** Ortamda `GOOGLE_CLIENT_ID` olmadığı için düğme render edilmedi; giriş sayfasındaki boşluk bu yüzden değerlendirilmedi.
- **Ödeme akışları:** Garanti Sanal POS / havale ekranları ortamda yapılandırılmadığı için test edilmedi (sepet ve üyelik modalı test edildi).
- **Push bildirimleri ve e-posta:** Test edilmedi.
- **Reklam, banner ve analitik betikleri:** Google Tag Manager ve reklam yerleşimleri test ortamında engellendi; gerçek reklamların düzene etkisi doğrulanmadı.
- **Hız sınırı:** Yoğun tarama sırasında backend'den bazı 429 (Too Many Requests) yanıtları alındı (profil sekmeleri). Bu bir test ortamı etkisidir; bulgulara dahil edilmedi.

---

## 9. Tekrar üretme notları

- **Ortam kurulumu:** `npm install`, `npx vite build`, `npx vite preview --port 4173`; `backend/` altında `composer install`, `.env.e2e` (sqlite), `php artisan e2e:seed`, `php artisan serve --port 8000`.
- **Ölçüm yöntemi:** Taşma, örtülme, küçük hedef, küçük yazı ve kontrast tespiti Playwright ile sayfa içinde `getBoundingClientRect`, `elementFromPoint` ve `getComputedStyle` kullanılarak yapıldı. Kontrast oranları WCAG göreli parlaklık formülüyle hesaplandı; resim veya gradyan zeminli öğeler hariç tutuldu.
- **Simülasyonlar:**
  - **Güncelleme bandı:** `/index.html?_v=*` isteği farklı bir `index-*.js` hash'i döndürecek şekilde yanıtlandı.
  - **Android kurulum istemi:** `beforeinstallprompt` olayı elle tetiklendi.
  - **Çevrimdışı:** Playwright `context.setOffline(true)` ile (service worker etkin).
- **Ekran görüntüleri:** `docs/tasarim-denetim/` klasöründe. Dosya adları bulgu numaralarıyla eşleşir.

---

## 10. Düzeltme durumu (2. aşama)

Denetimden sonra 31 bulgunun tamamı ele alındı. Her düzeltme aynı test ortamında (production paketi + Chromium emülasyonu) tarayıcıda yeniden ölçüldü. Gerçek cihaz doğrulaması (§8) hâlâ gerekli.

### 10.1 Özet

| Durum | Adet | Bulgular |
|---|---|---|
| Düzeltildi ve tarayıcıda doğrulandı | 29 | TD-01…TD-05, TD-07…TD-26, TD-28…TD-31 |
| Kısmen düzeltildi | 1 | TD-06 (yapısal sınır, aşağıda) |
| Değişiklik gerekmedi (test ortamı kaynaklı) | 1 | TD-27 |

Denetim sırasında ayrıca önceden var olan **3 ek hata** bulunup düzeltildi:
- **Mesajlar listesi mobilde taşıyordu:** Uzun son-mesaj önizlemesi ızgarayı yaklaşık 770 px'e çıkarıyordu; arama kutusu ve "İstekler" sekmesi ekran dışında kalıyordu.
- **Kurulum kartı 360 px'te 9 px taşıyordu:** "Hızlı" süre seçeneği ve "Katıl" düğmesi kesiliyordu.
- **Turnuva liste kartında katılımcı satırı dağınıktı:** Detay sayfası için yazılmış ızgara kuralı liste kartına da uygulanıp satırı dört sütuna dağıtıyordu.

### 10.2 Tam tarama karşılaştırması (75 rota × 11 boyut = 814 yükleme)

Aynı betik ve aynı test verisiyle, düzeltme öncesi ve sonrası:

| Ölçüt | Önce | Sonra |
|---|---|---|
| Yatay kaydırma olan sayfa | 0 | 0 |
| Ekran dışına taşan etkileşimli öğe | 70 | 25 → 0* |
| Kapalı menüde (ekran dışı) odaklanabilir öğe | 5 858 | 0 |
| 24 px altı dokunma hedefi | 554 | 151 |
| 11 px altı yazı (ölçüm sayısı) | 10 576 | 2 478 |
| WCAG AA altı kontrast (ölçüm sayısı) | 1 080 | 537 → (aşağıya bakın) |
| Sayfa yükleme hatası | 0 | 0 |

\* Taramada kalan 25 öğe, düzeltme sonrası ortaya çıkan önceden var olan iki hatadan geliyordu (Mesajlar ızgarası, kurulum kartı). İkisi de düzeltildi; ilgili sayfalarda yeniden ölçümde 0 kaldı.

Kalan küçük hedeflerin çoğu form etiketleri (`<label>`; dokunma alanı ilişkili `input`), metin içi bağlantılar (WCAG'de satır içi bağlantılar muaf) ve sözlükteki dekoratif tahta etiketleridir. Kontrastın son ölçümü (koyu + açık tema, 7 sayfa × 2 boyut) aşağıda.

### 10.3 Bulgu bazında yapılan değişiklik ve doğrulama

| No | Yapılan değişiklik | Doğrulama (sonra) |
|---|---|---|
| TD-01 | `UpdateBanner`, güvenli olmayan anda (maç, ödeme, okuma) her saniye kontrolle gizleniyor; "Sonra" (×) düğmesi eklendi. `unsafeToPrompt` dışa açıldı. | Bandı gösterip oyuna girildiğinde band dikeyde ve yatayda görünmüyor; "Sonra" ile kapanıyor. |
| TD-02 | 360 px kuralındaki `button:not(...)` seçicisinden giriş düğmesi çıkarıldı (onu 34 px'e zorluyordu); ölü `.app.lobby > .account-bar` seçicisi düzeltildi. BETA rozeti ≤560 px'te logonun altına alındı. Giriş düğmesi büzülmüyor. Üst çubuktaki hata bayrağı kaldırıldı (çekmeceye taşındı). Hesap adı genişliği sınırlandı. | 360 px: "Giriş / Kayıt" 86 px (önce 34). Dil düğmesi sağ kenarı 352 / 380 / 420 px (360 / 390 / 430), hepsi ekranda. Oturum açıkken avatar 352 px. |
| TD-03 | Giriş alanlarında Enter / "Git" doğrudan `doLogin`; `enterKeyHint`. | Enter → "E-posta/takma isim veya şifre hatalı." (kayıt uyarısı yok). |
| TD-04 | Açık sohbet artık sağdan açılan tam yükseklik sayfa (perde + × + Esc). ≥1440 px'te tahtanın yanında kalıcı sütun; tahta ölçüleri buna göre yeniden hesaplanıyor. | 1440: tahta 290–1018, sohbet 1080–1440 (örtüşme yok). 1920: tahta ≤1529, sohbet 1560+. 1280 / 768'de perdeli sayfa. |
| TD-05 | Mobilde sohbet gizlenmiyor. Dikeyde alt-sağ hap, yatayda menü düğmesinin altında ikon; açılınca tam ekran. | 360 / 390 dikey ve 844 yatayda sohbet bulunup açılıyor. |
| TD-06 | **Kısmen.** Dikey telefonda pul tepsisi taşa oranlı daraltıldı ve tahtaya yer açıldı. Nokta numaraları en az 11 px, zarlar en az 22 px. Menü düğmesi tepsinin üstünden alındı. | Taş 360 px'te 19 → 21 px, 390 px'te 21 → 22 px; numaralar 9,7 → 11 px. **Sınır:** Tahta 12 haneyi yan yana sığdırmak zorunda; dikey 360 px'te taşın ~28 px'i aşması mümkün değil. Haneler (tam sütun) dokunma hedefi olduğu için hedef genişliği ≥24 px. Yatay mod önerisi korunuyor. |
| TD-07 | ≤900 px'te yüzen "Hata Bildir" gizlendi; çekmece menünün en altına "Hata Bildir" eklendi. Masaüstünde içerik sağ payı ≥52 px. | `.bug-fab` mobilde `display:none`; Gönder düğmesi açık; çekmece öğesi Hata Bildir modalını açıyor. |
| TD-08 | `LoadError` (mesaj + "Tekrar dene") ve `useOnReconnect` eklendi. Turnuva listesi/detayı ile lider tablosu hatayı boş listeden ayırıyor. Uygulama genelinde alt "Çevrimdışısın" şeridi var. | Çevrimdışı: "Veriler yüklenemedi / İnternet bağlantını kontrol et / Tekrar dene". Bağlantı dönünce turnuva listesi kendiliğinden 3 karta yenilendi. |
| TD-09 | Ücret rozeti mutlak konumdan rozet satırının akışına alındı; satır sarıyor ve flamaya pay bırakıyor. | 360 / 390 / 768 / 844 / 1366 px'te kart içi çakışma 0. |
| TD-10 | ≤480 px'te katılımcı ızgarası tek sütun; ad alanı kalan genişliği alıyor. | 360 px: "Ayşe0", "Mehmet1", "Muhteşemoyuncu1", "WWWWWWWWWWWWWWW" kesilmeden. |
| TD-11 | İzleme 404/410'da "Bu maç bulunamadı ya da sona erdi" + "Canlı maçlara dön"; sorgulama duruyor; rozet "Maç bulunamadı". | `/izle/ABCDEF` 4 sn'de mesaj gösteriyor. |
| TD-12 | Hamburger payı kaynak sırasına uygun yere (temel kuraldan sonra, ≤900 px) taşındı. | 768 / 800 / 844 px: hamburger 0–52, logo 60'tan başlıyor. |
| TD-13 | Üst çubuk, çekmece, lobi içeriği ve footer `env(safe-area-inset-left/right)` kullanıyor. | iPhone yatay emülasyonu: hamburger 47–99, logo 107, dil düğmesi ≤797, kartlar 55–789, çekmece öğesi x=98. |
| TD-14 | Oyuncu adı en fazla 2 satıra sarıyor (`line-clamp`). | 844×390 ve 360×800'de "Seviye 1 · Neural AI" tam okunuyor. |
| TD-15 | Dikey ekranda oyun menüsü düğmesi sağ üste (tam ekran düğmesinin soluna) alındı. | 360 px: düğme y=12–50, tahta 369+'dan başlıyor. |
| TD-16 | Kurulum aksiyonları (`.setup-actions`, `.solo-preview-bar`) yapışkan alt çubuk oldu. | "Başla" 1280×720'de y=668–710, 1440×900'de 848–890, 390×844'te 792–834 (kaydırmadan görünür). |
| TD-17 | iOS rehberi `createPortal` ile `body`'ye render ediliyor. | Karartma katmanı 0,0 → 390,844 (tam ekran). |
| TD-18 | Kurulum istemi, güncelleme bandı görünürken bekliyor. Kapat düğmesi 40 px; düğme metni "Yükle". | İki bildirim aynı anda çıkmıyor; düğmeler 70×42 ve 40×40. |
| TD-19 | Kapalı çekmece ve oyun menüsü `visibility:hidden` (geçiş sonrası); oyun menüsü `aria-hidden`; Esc çekmeceyi kapatıyor; hamburgerde `aria-expanded`. | Tab sırası: Menü → Logo → Giriş → Tema → Dil → içerik (gizli menüye gitmiyor). Esc kapatıyor. |
| TD-20 | Breadcrumb ≥32 px dokunma alanı, SSS arama kutusu 44 px, coin çipi 34 px, Maç ID 28 px, oyun menüsü kapat 40 px, izleme ses düğmesi 40 px, döndürme ipucu kapat 32 px. | 24 px altı hedef ölçümü 554 → 151. |
| TD-21 | Mikro etiketlere 11 px taban; BETA 10 / 9 px; ay adı 10,5 px; bot seviyesi 11,5 px. | 11 px altı yazı ölçümü 10 576 → 2 478. |
| TD-22 | Açık tema: Premium rozeti, "Kayıt açık", galibiyet/mağlubiyet, coin, nadirlik ve seviye etiketleri koyulaştırıldı; takvim yeşili değişkene alındı. | Bkz. 10.4. |
| TD-23 | Metin ve zemin vurgusu ayrıldı: 265 `color: var(--accent)` kullanımı `--accent-text`'e taşındı. Koyu temada metin #E07A63, düğme zemini #B04A35. | Bkz. 10.4. |
| TD-24 | Çekmecede logo satırı yapışkan ve opak. | Kaydırılan menü öğeleri hamburgerin altına girmiyor. |
| TD-25 | Giriş hatasında yinelenen toast kaldırıldı (yalnız satır içi `role=alert`). Google düğmesi çizilemezse "veya" ayracı ve boş alan gizleniyor. | Tek hata mesajı; Google yokken boşluk yok. |
| TD-26 | Mobilde çerez metni 3 satıra (yatayda 2) kısaltıldı; yatayda düğmeler tek satır. | Kaplanan alan dikeyde %41 → %29, yatayda %51 → %28. |
| TD-27 | Değişiklik yok: üretimde Laravel `Route::fallback` markalı 404 döndürüyor; bulgu yalnızca `vite preview` ortamına özgü. | — |
| TD-28 | `.app.game-view` zemini oyun sahnesiyle aynı. | Krem kenar yok (masaüstü, mobil, PWA). |
| TD-29 | Sol menü ve Mesajlar sekmesi rozetleri de "sohbet + bildirim" toplamını gösteriyor. | Üst çubuk 4, sekme 4, sol menü 4. |
| TD-30 | Döndürme ipucu yalnız ≤600 px dikey (telefon); sola hizalı. | 768 px tablette çıkmıyor. |
| TD-31 | Çekmece gölgesi yalnız açıkken uygulanıyor. | Kapalıyken `box-shadow:none`; sol kenarda gri şerit yok. |

### 10.4 Kontrastın son ölçümü

Koyu ve açık temada 5–7 sayfa, masaüstü ve 390 px'te yeniden ölçüldü.

**Hâlâ eşik altında kalanlar (bilinçli istisna):**
- Bitmiş turnuvanın soluk tarih rozeti (koyu tema 2,97:1): pasif/geçmiş öğe bilerek soluk gösteriliyor.

**Hatalı alarmlar (ölçüm aracının zemini göremediği durumlar):**
- Sol menüde aktif öğe: zemin `::before` ile çiziliyor.
- "Turnuva Lobisi" bağlantısı.
- 🥇 emojisi: renk uygulanmıyor.

**Eşik üstüne çıkanlar (örnekler):**
- "Giriş / Kayıt" (koyu tema): 3,83 → ~4,8:1.
- Vurgu metinleri (koyu tema): 3,1–3,7 → ~5,4:1.
- Premium rozeti (açık tema): 1,6–1,9 → ~6:1.
- Takvim yeşili: 4,39 → ~6:1 (açık), 3,65 → ~7:1 (koyu).

### 10.5 Estetik öneriler

| No | Durum | Doğrulama |
|---|---|---|
| E-1 | Uygulandı: mobilde boş "Çevrimiçi Oyuncular" kartı rezerv yüksekliğini bırakıyor. | — |
| E-2 | Uygulandı: ≤560 px'te canlı maç filtreleri tek satır, yatay kaydırılabilir. | — |
| E-3 | Uygulandı: aktif menü öğesinin flaması menü kartının içinde bitiyor. | 1440: flama sağ ucu 214 px, kart sağ kenarı 224 px. |
| E-4 | Uygulandı: final/şampiyon sütunlarındaki sabit 400 px yükseklik yalnız üçüncülük maçı varken uygulanıyor; ≤640 px'te başlıkta "← kaydırarak tüm turlar →" ipucu. | 4 kişilik tablo yüksekliği 200 px; ipucu yalnız mobilde. |
| E-5 | Düzeltme: tam boyutta incelendiğinde tahta küçük **değil** (1440'ta 974 px, yüksekliği dolduruyor); denetimdeki tespit küçük önizlemeden kaynaklı bir yanılgıydı. Asıl sorun olan küçük yazılar giderildi: ≥901 px'te skor şeridi ve "Çok Sıkıldım" paneli büyütüldü. | — |
| E-6 | Uygulandı: üyelik modalında planlar alt alta dizildiğinde ücretli plan üstte; "Abone Ol" alanı kart içinde yapışkan. | "Abone Ol" 360×800'de y=447–489, 844×390'da y=329–371 (kaydırmadan görünür). |
| E-7 | Uygulandı: kurulu PWA'da (`display-mode: standalone` veya iOS `navigator.standalone` → `<html class="is-standalone">`) sayfa başında "‹ Geri". Geçmiş yoksa ana sayfaya döner. Tarayıcı modunda gizli. | Standalone emülasyonunda görünür, tarayıcıda `display:none`; derin bağlantıdan ana sayfaya, menüden gelinince bir önceki sayfaya dönüyor. |
| E-8 | Uygulandı: hamburger baloncuğu kaldırıldı; kurulum istemi düğme metni kısaltıldı. | — |

### 10.6 Dağıtım

Derlenmiş çıktı `npm run deploy:build` ile `backend/public`'e kopyalandı ve commit'lendi. Betik ek modda çalışır: eski hash'li dosyalar korunur. Değişiklikler `claude/cloud-session-credits-9nd4yl` dalında. Canlıya çıkış için kalan adımlar: dalın sunucunun çektiği ana dala (main) birleştirilmesi, ardından Plesk'te `git pull` + `deploy.sh`.
