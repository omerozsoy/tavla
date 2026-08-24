# TavlaTv — Gece Denetim Raporu

**Tarih:** 2026-08-24 (gece)
**Kapsam:** Güvenlik (backend + ödeme) ve UI/UX denetimi + düzeltmeler
**Yöntem:** Üç paralel denetim ajanı (backend güvenlik, ödeme güvenliği, UI/UX). Tüm bulgular gerçek kod üzerinde **doğrulandı**; yalnızca teyit edilenler düzeltildi. Yanlış alarmlar aşağıda ayrıca listelendi.

Bu gece yapılan tüm değişiklikler `main`'e commit'lendi ve push'landı. **Production'da görünmesi için `backend/`'i deploy etmen gerekiyor** (bkz. son bölüm).

---

## 1) ÖZET — Bu gece düzeltilenler

### Güvenlik (para bütünlüğü — en yüksek öncelik)
| # | Konu | Önem | Durum |
|---|------|------|-------|
| 1 | Ödeme callback: replay / çift plan aktivasyonu | KRİTİK | ✅ Düzeltildi |
| 2 | Ödeme callback: tutar (txnamount) doğrulaması yok | YÜKSEK | ✅ Düzeltildi |
| 3 | Ödeme callback: rate-limit yok (forged flood) | DÜŞÜK | ✅ Düzeltildi |
| 4 | `email_verified_at` mass-assignment ile doğrulama atlama | KRİTİK | ✅ Düzeltildi |
| 5 | Mağaza satın alma: çift satın alma / eksi bakiye yarışı | KRİTİK | ✅ Düzeltildi |
| 6 | Günlük ödül: çift ödül (eşzamanlı istek) | YÜKSEK | ✅ Düzeltildi |
| 7 | Turnuva katılım ücreti: çift tahsil / çift katılım | KRİTİK | ✅ Düzeltildi |
| 8 | Turnuva ödülü: çift ödeme / bracket bozulması | KRİTİK | ✅ Düzeltildi |
| 9 | Bahis oda settle: net coin üretimi/kaybı (eşzamanlı) | YÜKSEK | ✅ Düzeltildi |

### UI/UX
| # | Konu | Durum |
|---|------|-------|
| 10 | Font pairing (başlıklar **Poppins** / gövde **Outfit**) | ✅ Yapıldı |
| 11 | Semantik renk token'ları (success/warning/error/info) | ✅ Eklendi |
| 12 | Gölge (elevation) token'ları (sm/md/lg/xl) | ✅ Eklendi |

---

## 2) GÜVENLİK — Düzeltme detayları

### 2.1 Ödeme (Garanti Sanal POS 3D) — `PaymentController@callback`
**Sorun:** Callback `status === 'pending'` kontrolünü yapıp ardından kaydı güncelliyordu — **atomik değildi**. Bankanın retry'i, replay ya da yarış durumunda iki callback de kontrolü geçip planı **iki kez** aktive edebilirdi. Ayrıca bankanın döndürdüğü **tutar hiç doğrulanmıyordu**.

**Düzeltme:**
- Plan aktivasyonu artık **atomik**: `UPDATE payments SET status='paid' WHERE id=? AND status='pending'` — yalnızca **ilk** başarılı callback planı açar (idempotent).
- `txnamount` (bankanın döndürdüğü tutar) kayıtlı `amount` ile karşılaştırılıyor; uyuşmazsa `failed`.
- `/pay/callback` route'una `throttle:30,1` eklendi.

### 2.2 `email_verified_at` mass-assignment — `User` modeli + `AuthController@googleLogin`
**Sorun:** `email_verified_at` `$fillable` içindeydi; kötü niyetli bir istek gövdesine bu alanı ekleyerek e-posta doğrulamasını atlayabilirdi.
**Düzeltme:** `$fillable`'dan çıkarıldı. Google girişinde doğrulama artık `markEmailAsVerified()` ile açıkça yapılıyor (güvenli).

### 2.3 Coin yarış koşulları (çift-harcama / çift-kredi)
Aşağıdaki tüm para işlemleri `DB::transaction` + `lockForUpdate` (satır kilidi) ile **atomik** hale getirildi:
- **`ShopController@buy`** — çift satın alma ve eksi bakiye engellendi.
- **`ShopController@daily`** — 6 saatlik cooldown kilit altında; çift ödül engellendi.
- **`TournamentController@join`** — çift ücret tahsili ve çift katılım engellendi (kapasite kontrolü kilit altında tutarlı).
- **`TournamentController@report`** — final ödülü kilit altında bir kez ödeniyor; "sonuç zaten girildi" yarış-güvenli; bracket bozulması engellendi. Ödül coin'i atomik artışla (`COALESCE(coins,0)+X`) veriliyor.
- **`RoomController@settle`** (bahisli oyunlar) — `settled` bayrağı + coin transferi **tek transaction**, her iki oyuncu deterministik sırayla kilitleniyor (deadlock önleme). Aynı kaybedenin eşzamanlı iki oda çözümünde net coin üretimi/kaybı engellendi.

---

## 3) GÜVENLİK — Kalan öneriler (yapılmadı, gerekçeleriyle)

Bunları **bilinçli olarak** yapmadım; ya risk düşük ya da banka/altyapı testine ihtiyaç var. Onay verirsen uygularım.

1. **Ödeme sahiplik bağı (`/pay/submit`, `/pay/card`)** — DÜŞÜK gerçek risk. Bu uçlar oturumsuz/imzalı akış için tasarlı. Saldırganın "başkasının planını kendi kartıyla ödemesi" saldırgana **fayda sağlamaz**. Yine de savunma amaçlı, `/pay/submit`'e imzalı bağ ekleyebiliriz.
2. **`mdstatus` sıkılaştırma** — şu an `['1','2','3','4']` kabul ediliyor; katı 3D için yalnızca `'1'`. **Ama bankaya bağlı** (3D'ye kayıtsız kartlar 2-4 dönebilir); TEST ortamında doğrulamadan değiştirmek gerçek ödemeleri bozabilir. Deneyerek karar verilmeli.
3. **Ödeme denetim günlüğü (audit log)** — her callback (başarı/başarısızlık, order_id, user_id, hash sonucu) loglanmalı. Anlaşmazlık/inceleme için önerilir.
4. **Login throttle** — şu an `throttle:20,1` (login/register/forgot ortak). Login'e özel `10,1` daha güvenli olur; ortak IP'de meşru kullanıcıyı kilitlememek için ölçülü tuttum.
5. **`deleteAccount` yetim kayıtlar** — DÜŞÜK. Kullanıcı silinince blunder/match/club/payment kayıtları yetim kalıyor. Cascade temizlik önerilir.
6. **Blunder verisi doğrulaması** — DÜŞÜK. İstemci keyfi istatistik gönderebilir (yalnızca kişisel istatistik; sömürü değeri düşük).

## 4) GÜVENLİK — Kontrol edilip TEMİZ çıkanlar (yanlış alarm)

- **SQL injection:** Yok — her yerde Eloquent (parametreli sorgu).
- **E-posta doğrulama SHA1:** Route `->middleware('signed')` ile korunuyor (HMAC imza + süre). Laravel'in varsayılan `sha1(email)` hash'i imzalı URL içinde; tek başına sömürülemez. **Temiz.**
- **Leaderboard'da coin/rating görünmesi:** Tasarım gereği (herkese açık sıralama). Sorun değil.
- **Google OAuth:** Token Google `tokeninfo` ucundan HTTPS ile doğrulanıyor; issuer kontrolü var. Kabul edilebilir.
- **`is_admin` / `plan` / `coins` / `rating` mass-assignment:** Bunların hiçbiri `$fillable` değil; güvenli. (Tek sorun `email_verified_at`'ti, o da düzeltildi.)

---

## 5) UI/UX — Yapılanlar ve yol haritası

### Bu gece yapıldı (global, en yüksek etki)
- **Font pairing:** Başlıklar artık **Poppins** (700/800, geometrik/premium), gövde **Outfit** kaldı. Bu, "yapay zeka yapımı" hissini en çok azaltan tek değişiklik. (`index.html` + `--tv-font-display`, `h1–h4` ve kart/rapor başlıklarına uygulandı.)
- **Token'lar:** `--color-success/warning/error/info`, `--shadow-sm..xl` eklendi (tablo/rozet/kart tutarlılığı için altyapı).

### Kalan yol haritası (öncelik sırası — onayınla yaparım)
Denetim ajanının tam raporu aşağıdaki başlıkları öneriyor; hepsi CSS düzeyinde, düşük riskli:

**P1 (yapılmalı):**
- **Tip ölçeği birliği:** h2/h3 boyutları sayfadan sayfaya oynuyor (1.2rem–1.9rem). Tek ölçek: 12/14/16/20/28/36.
- **Düğme durumları:** `.menu-btn`, `.setup-tile`, `.galaxy-btn` için tutarlı hover/active/disabled/focus-visible.
- **Form alanları:** görünür label + focus box-shadow + hata durumu netliği.
- **Kart gölgeleri:** yeni `--shadow-*` token'larını tüm kartlara uygula.
- **Boş/yükleme durumları:** tek `.empty-state` + spinner standardı.

**P2:** Tablo hiyerarşisi (Leaderboard/Turnuvalar), rozet/etiket sistemi, kart iç boşlukları.
**P3:** Tüm sayısal alanlara `tabular-nums` (skor/coin/süre kaymaz), 44px dokunma hedefleri, ikon boyut tutarlılığı, açık temada `--tv-ink-faint` kontrastı (AA altında — düzeltilmeli).

> Not: Denetim ajanının önerdiği bazı CSS parçaları SCSS `@extend` içeriyordu; bunlar düz CSS'te çalışmaz. Uygularken düz CSS'e çevireceğim.

---

## 6) DEPLOY — Bunların görünmesi için

Tüm değişiklikler `main`'de. Production'da (tavlatv.com / tavlai.com) görünmesi için:

1. Güncel **`backend/`** klasörünü sunucuya al (özellikle `backend/public/` yeni derleme + değişen PHP controller'lar).
2. Sunucuda:
   ```
   php artisan optimize:clear
   ```
   (Yeni migration yok; DB değişikliği gerektirmiyor.)
3. Tarayıcıda **Ctrl+Shift+R** (service worker cache v3 zaten eski asset'leri temizliyor).

**Öneri:** Plesk Git otomatik deploy'u kurarsan (repoda `deploy.sh` hazır) her push otomatik yayına alınır; elle yükleme derdi biter. Kurulum adımlarını önceki mesajda bıraktım.

---

## 7) Değişen dosyalar (bu gece)

**Backend (güvenlik):**
- `app/Http/Controllers/PaymentController.php` — atomik callback + tutar doğrulama
- `routes/web.php` — callback throttle
- `app/Models/User.php` — `email_verified_at` fillable dışı
- `app/Http/Controllers/AuthController.php` — Google `markEmailAsVerified`
- `app/Http/Controllers/ShopController.php` — buy/daily transaction
- `app/Http/Controllers/TournamentController.php` — join/report transaction
- `app/Http/Controllers/RoomController.php` — settle transaction

**Frontend (UI/UX):**
- `index.html` — Poppins fontu
- `src/App.css` — display font + renk/gölge token'ları + başlık kuralı

**Diğer (bu oturumda daha önce):** temiz URL routing (`/yapay-zeka` vb.), Pozisyon Analizi in-flow sayfa, "Nasıl Oynanır" menüden kaldırma, Tavla Kulüpleri rehberi bağlama, service worker cache v3.

---

*Sabah görüşürüz. Kalan güvenlik önerileri ve UI P1-P3 yol haritası için onayın yeterli — sırayla uygularım.*
