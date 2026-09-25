# TavlaTV mobil ve responsive audit

Tarih: 2026-09-25  
Kapsam: frontend kaynak kodu + yerel Vite/Laravel çalıştırması + Playwright tarayıcı kontrolleri  
Durum: Bu çalışma yalnızca audit raporudur. Uygulama kodunda veya CSS'te değişiklik yapılmadı.

Uygulama durumu: Audit sonrasında MOB-001, MOB-002, MOB-003 ve yerel API proxy bulguları düzeltildi. Aşağıdaki ölçümler ilk audit anındaki doğrulanmış durumdur; düzeltme doğrulaması raporun sonundadır.

## Öncelik sırasına göre kısa düzeltme listesi

1. **Yüksek — 320 px üst barı:** Dil seçici ve hata bildir kontrolü viewport dışına taşıyor; kullanıcı bunlara erişemiyor.
2. **Orta — mobil footer:** Footer bağlantılarının gerçek `button` alanı yalnızca 16–17 px yüksekliğinde; dokunmatik kullanım için çok küçük.
3. **Orta — 1024 px footer yoğunluğu:** Footer yedi kolonu tek satırda koruyor; tablet genişliğinde yazılar ve bağlantı kümeleri gereğinden küçük/dense hale geliyor.
4. **Orta — test edilebilirlik/ortam:** Vite dev sunucusu `localhost:8000` API’sini hedefliyor; sayfa `127.0.0.1:5199` üzerinden açıldığında tarayıcı CORS hataları oluşuyor. Bu bir kullanıcı viewport bulgusu değil, yerel audit ortamı sorunudur; CI/QA komutları tek host adı kullanmalı.

## Denetim yöntemi

- Kaynak taraması: `src/App.tsx`, `src/App.css`, `src/ui/Footer.tsx`, `src/ui/footer.css`, `src/ui/GlossaryView.tsx`, `src/ui/LobbyLayout.tsx`, `src/api.ts`, route/SEO slug haritaları ve mevcut Playwright responsive scriptleri incelendi.
- Yerel çalışma: Vite `http://127.0.0.1:5199`; Laravel `http://127.0.0.1:8000` ile başlatıldı. Mevcut responsive harness incelendi ve kontrollü Playwright kontrolleri çalıştırıldı.
- Viewport seti: 320, 360, 390, 430, 768, 1024 ve 1440 px genişlikleri; portre yükseklikleri olarak yaklaşık 640/800/844/932/1024/900 px, ayrıca 1024×768 yatay kontrolü.
- Ölçülenler: `document.documentElement.scrollWidth - innerWidth`, taşan DOM kutuları, görünür başlık/içerik, footer kutusu, link/button kutuları, console/page error, drawer açılması, modal/kurulum akışı ve oyun tahtası/overlay yerleşimi.
- Etkileşimler: mobil hamburger açıldı; drawer içinden **Tek Oyun** seçildi; kurulum overlay’i ve solo kart ölçüldü; sözlük arama alanı ve içerik görünümü kontrol edildi; footer bağlantı/button geometrileri viewport bazında ölçüldü.
- Ekran görüntüsü: Bu auditte kalıcı screenshot dosyası bırakılmadı; kullanıcı isteği doğrultusunda yalnızca bu rapor dosyası oluşturuldu. Bulgular DOM ölçümleri ve tekrar üretim adımlarıyla kanıtlandı.

## Kapsanan sayfa türleri

Temsilî olarak ana lobi/ana sayfa, online tavla SEO görünümü, tavla rehberi ve makale yönlendirmesi, sözlük (`/bilgi/sozluk`), turnuvalar ve turnuva takvimi, liderlik, pozisyon analizi, `.mat` analiz giriş noktası, üyelik/giriş URL’leri, mağaza, sepet, bilgi sayfaları, mobil drawer, footer ve Tek Oyun kurulum akışı incelendi.

Kod tarafında rota ailesi ayrıca doğrulandı: `src/App.tsx:1173-1440` deep-link slug → görünüm eşleşmelerini; `src/App.tsx:8636-8661` ortak `LobbyLayout` + footer kabuğunu; `src/ui/Footer.tsx:42-100` footer render’ını; `src/ui/GlossaryView.tsx` sözlük görünümünü; oyun responsive davranışını `src/App.css:7219-7469` ve `src/App.css:8289-8378` bölümlerini kapsıyor.

## Doğrulanmış bulgular

### MOB-001 — 320 px üst bar kontrolleri viewport dışına taşıyor

- **Öncelik:** yüksek
- **Sayfa/rota:** `/` ana lobi; aynı ortak üst barı kullanan lobi sayfaları
- **Ekran genişliği:** 320 px (özellikle 320×640/800)
- **Tekrar oluşturma:**
  1. Siteyi 320 px genişliğinde aç.
  2. Üst sağdaki tema, hata bildir ve dil ikonlarını gözle veya Playwright `getBoundingClientRect()` ile ölç.
  3. Dil düğmesine erişmeye/tıklamaya çalış.
- **Beklenen davranış:** Üst barın tüm temel kontrolleri 320 px içinde görünür ve dokunulabilir olmalı; hiçbir kritik kontrol ekranın sağında kesilmemeli.
- **Gerçekleşen davranış:** 320 px ölçümünde üst bar kutuları şu konumlarda görüldü: giriş/kayıt yaklaşık `x=147,w=84`; tema `x=236,w=42`; hata bildir `x=282,w=42`; dil `x=328,w=42`. Dil düğmesinin sağ kenarı `370 px`, yani viewportun `50 px` dışında. Sayfanın global `overflow-x` gizli olduğu için `scrollWidth` farkı 0 raporlansa da içerik görünür biçimde kırpılıyor ve kontrol erişilemez hale geliyor. 360 px ve üzerindeki ölçümlerde bu spesifik taşma görünmedi.
- **İlgili dosya/bileşen:** `src/App.tsx` üst hesap/marka barı; `src/App.css:9928-9954`, `src/App.css:10064-10087`, `src/App.css:10275-10332`; `LangMenu`/hata bildir/tema düğmeleri.
- **Kök neden hipotezi:** Dar ekran medya kuralları barı `nowrap` tutuyor; logo + giriş + tema + hata + dil toplam minimum genişliği 320 px’e sığmıyor. `overflow-x:hidden` taşmayı saklıyor, fakat düzen elemanlarını erişilebilir biçimde yeniden akıtmıyor.
- **Somut düzeltme önerisi:** 320 px için öncelik sırasına göre bir kontrol gizle/kısalt; logo ve giriş butonunu daha da küçültmek yerine hata bildirimini menü içine taşı veya tema/dil kontrollerini açılır menüde grupla. Sonuçta her görünür etkileşimli kutunun sağ kenarını `<= innerWidth` ile test eden bir regresyon assertion’ı ekle.

### MOB-002 — Mobil footer bağlantılarının dokunma alanı çok küçük

- **Öncelik:** orta
- **Sayfa/rota:** `/` ve `LobbyLayout` footer’ını kullanan tüm lobi/SEO/bilgi sayfaları
- **Ekran genişliği:** 320, 360, 390, 430 ve 768 px; ayrıca 1024/1440’ta da aynı temel ölçü görüldü
- **Tekrar oluşturma:**
  1. Sayfayı belirtilen genişliklerden birinde aç.
  2. Sayfanın en altındaki footer’a kaydır.
  3. Footer içindeki `Tek Oyun`, `Online Turnuvalar`, `Sözlük`, `Hakkında` gibi bağlantılara ait button/link kutularını ölç veya art arda dokun.
- **Beklenen davranış:** Footer bağlantılarının her biri mobil dokunmatik kullanım için yaklaşık 44 px yüksekliğinde bir hit area sunmalı; komşu bağlantılar arasında yanlış dokunma riski düşük olmalı.
- **Gerçekleşen davranış:** 320/360/390/430 px ölçümlerinde footer `.foot-link` kutuları yaklaşık `h=17 px`; 768/1024 px’te yaklaşık `h=16 px`; 1440 px’te yaklaşık `h=18 px`. Görsel metin okunabilir olsa da gerçek `button` kutusu yalnızca satır yüksekliği kadar. `scrollWidth` taşması yok, sorun erişim alanı boyutudur.
- **İlgili dosya/bileşen:** `src/ui/Footer.tsx:42-100`; `src/ui/footer.css:158-183`, mobil kurallar `src/ui/footer.css:216-249`.
- **Kök neden:** `.foot-link` `padding: 0`, `line-height: 1.35` ile yalnızca metin satırını hit area yapıyor; mobil medya kuralı yalnızca font boyutunu değiştiriyor.
- **Somut düzeltme önerisi:** Mobilde `.foot-link` için en az 40–44 px dikey padding/min-height ver; kolon içi `gap` değerini bu yeni hit area ile yeniden dengele. Görsel düzen bozulmaması için `align-items:flex-start` ve `line-height` korunabilir. Playwright’ta mobil tüm görünür footer button/link’leri için `width >= 24` ve `height >= 40` assertion’ı ekle.

### MOB-003 — 1024 px footer yedi kolonlu ve gereğinden yoğun

- **Öncelik:** orta
- **Sayfa/rota:** `/` ve footer kullanan tüm sayfalar
- **Ekran genişliği:** 1024 px tablet; karşılaştırma için 768 ve 1440 px
- **Tekrar oluşturma:**
  1. Sayfayı 1024 px genişliğinde aç.
  2. Footer’a kaydır.
  3. Yedi kolonun aynı satırda kaldığını, başlık ve link metinlerinin yaklaşık `0.76rem`/16 px satır yüksekliğiyle sıkıştığını kontrol et.
- **Beklenen davranış:** Tablet genişliğinde footer kolonları rahat okunmalı; bağlantılar ya daha az kolona gruplanmalı ya da anlamlı biçimde iki satıra akmalı.
- **Gerçekleşen davranış:** `1024 px` ölçümünde footer kutusu `w=1024`; `.foot-cols` yedi kolonlu grid olarak devam ediyor. Kolonlar taşmıyor ancak her kolon dar, link satırları yaklaşık 16 px yüksekliğinde ve çok sayıda bağlantı aynı yatay ritimde sıkıştırılmış. 768 px’te aynı yoğunluk daha belirgin; 620 px altında üç kolona geçiş yapılıyor.
- **İlgili dosya/bileşen:** `src/ui/footer.css:128-183`, özellikle `src/ui/footer.css:216-249`; `src/ui/Footer.tsx`.
- **Somut düzeltme önerisi:** 1024/768 aralığında yedi kolon yerine 4+3 veya 3+3+1 düzenine geç; link hit area büyütülürken kolon başına bağlantı sayısını azalt. Bu, MOB-002 ile birlikte çözülmeli.

## İncelendi, sorun doğrulanmadı

- **Yatay overflow:** Temsilî sayfalar ve 320/360/390/430/768/1024/1440 ölçümlerinde `document.documentElement.scrollWidth - innerWidth` değeri 0 çıktı. Bu, içerik kırpılmasını dışlamaz; MOB-001 bunun örneğidir.
- **Mobil drawer:** 320, 360, 390, 430 ve 768 px’te hamburger açıldı; drawer `248 px` genişlik ve viewport yüksekliği boyunca açıldı. Drawer menü düğmeleri yaklaşık `44 px` yüksekliğinde; bu akışta taşma gözlenmedi.
- **Tek Oyun kurulum overlay’i:** 320 px’te `.solo-card` yaklaşık `292×582 px`, 390 px’te `362×582 px`, 430 px’te `402×582 px`; overlay dikey olarak sayfadan uzun olsa da scroll edilebilir ve global yatay taşma üretmedi. 768 px’te kart yaklaşık `740×591 px` oldu.
- **Sözlük:** `/bilgi/sozluk` görünümü 320/390/768 px’te açıldı; arama input’u sırasıyla yaklaşık 210/280/462 px genişlikte, içerik tek kolona geçiyor ve yatay taşma ölçülmedi.
- **Modal kapatma:** CSS’te `.modal-close` görsel kutusu 30 px olsa da `::before` ile 44×44 px dokunma alanı tanımlanmış (`src/App.css:7677-7705`). Bu nedenle yalnızca görsel 30 px ölçüsünü sorun olarak yazmadım.
- **Oyun tahtası:** Kaynakta portre/yatay oyun için ayrı medya kuralları mevcut (`src/App.css:8289-8378`, `src/App.css:9292-9320`); yerel misafir akışında tam maç tahtasına girip zar/hamle/drag etkileşimini backend ve eşleşme servisi olmadan güvenilir biçimde tamamlayamadım. Bu nedenle tahta hakkında doğrulanmamış kusur iddiası yok.

## Test edilemeyen veya kısmi kalan alanlar

- Auth gerektiren profil, üyelik devam akışı, sipariş/ödeme ve kullanıcıya özel formların submit/validation durumları.
- Gerçek online eşleşme, rakip senkronizasyonu, turnuva maçına katılım, canlı chat ve oyun tahtasında gerçek zar/hamle akışı.
- Dolu turnuva listesi, gerçek haber/makale görselleri ve backend’den gelen mağaza/ürün kataloglarının tüm varyasyonları.
- Bazı route’ların ilk yüklemesinde yerel backend yoğunluğu nedeniyle `ERR_NETWORK_ACCESS_DENIED`/timeout görüldü. `127.0.0.1:5199` ile açılan frontend, kodda sabitlenen `localhost:8000` API çağrılarıyla host adı farklı olduğu için CORS hatası üretti. Bu durum ayrı bir geliştirme/test yapılandırması bulgusudur; sayfa tasarım hatası olarak sınıflandırılmadı.

## Sonuç ve sonraki adım

Öncelikli düzeltme sırası: önce 320 px üst bar erişilebilirliği, sonra footer hit area ve tablet footer yoğunluğu. Bu üç konu ortak olarak üst/alt gezinme chrome’unda sabit genişlik ve satır yüksekliği varsayımlarından kaynaklanıyor. Düzeltme sonrasında aynı viewport setinde DOM sınırları ve dokunma alanları otomatik assertion olarak korunmalı.

## Düzeltme doğrulaması

- 320 px: üst barın görünür kritik düğmeleri viewport içinde (`right <= 320`), ikon kontrolleri 34 px; hata bildirimi 44×44 px mobil FAB olarak erişilebilir.
- 320/390/768/1024 px: footer linkleri sırasıyla 44/44/36/36 px hit area ölçüldü; yatay overflow 0 px.
- 768/1024 px: footer `.foot-cols` dört kolonlu düzene geçiyor; 620 px altında üç kolonlu mobil düzen korunuyor.
- `http://127.0.0.1:5199/api/site-tags`: Vite proxy üzerinden HTTP 200 doğrulandı; frontend artık dev ortamında mutlak `localhost:8000` API URL’sine bağımlı değil.
- `npm run typecheck`, `npm run build` ve `npm run lint` başarılı. Lint yalnızca mevcut, hata seviyesine yükseltilmemiş uyarılar verdi.
