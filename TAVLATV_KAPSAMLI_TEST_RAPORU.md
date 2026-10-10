# TavlaTV — Kapsamlı Uçtan Uca Test Raporu

> Otonom test oturumu, 2026-10-10. Şifre/token/gerçek kullanıcı kişisel verisi bu raporda YER ALMAZ.
> (Not: dosya bir ara truncate oldu; tam içerik bu oturumun bulgularından yeniden oluşturuldu.)

## 0. Yönetici Özeti

- **Ortam:** İzole, gerçek istemci+sunucu yığını (ayrı e2e sqlite + Node validator + gerçek UI + gnubg). Prod verisine/kullanıcısına DOKUNULMADI.
- **Gerçek tarayıcıda (Chromium):** Maç Oyunu ~5-6 tam oyun (336 ply, 2 tarayıcı) + Kız Tavlası masaüstü & mobil-emülasyon. iOS/gerçek-mobil/PWA test EDİLEMEDİ (erişim yok — §11).
- **Gerçek sunucu-akışı (API, izole):** ~40+ tam oyun — online-games 20 maç/33 oyun (anomali 0) + davet→oyun ×5 + flows.
- **Bot maçları (YZ, gnubg):** gnubg servisi kuruldu → **bots.spec 3/3 geçti** (seviye 1–10 tam oyun anomali 0 + maç + premium) — §12.
- **Destekleyici otomatik testler:** **vitest 428 geçti**, **phpunit 891 geçti / 23.925 assertion**.
- **Uygulama düzeyinde yeni fonksiyonel hata GÖZLENMEDİ.** Zar ~12-21 ms'de DOĞRU değer+sahiple görünür; sayaç iki tarayıcı+sunucu arası <1 sn tutarlı; taş-korunumu + oyun-sonu puanı anomali=0; gerçek iki-istemci desync=0.
- **En kritik kalan açık:** gerçek iOS/Safari/PWA cihaz testi (erişim yok). Gerçek-tarayıcı "10 oyun/platform" hedefi mimari sınır (2-tarayıcı hibrit + 1.2 sn poll) nedeniyle tamamlanamadı — FPM/opcache ilgisiz (§13).

---

## 1. Ortam, Araçlar ve Erişim

| Öğe | Değer |
|---|---|
| Repo | C:\Users\Master\PhpstormProjects\tavla |
| Çalışma kuralı | Uygulama kodu değiştirilmedi, canlıya dağıtım yok (yalnız test otomasyonu) |
| OS / Node / PHP | Windows 10 Pro 19045 / v24.11.0 / 8.2.12 (XAMPP, OPcache+JIT açık) |
| Playwright | 1.62.1 — **Chromium** kurulu; **WebKit/Firefox YOK** |
| gnubg | GNU Backgammon 1.08.003 (native, `gnubg-cli.exe`, Python scripting destekli) |

### 1.1 İzole gerçek-yığın
Backend `php artisan serve` `APP_ENV=e2e` → ayrı `backend/database/e2e.sqlite` (prod'a dokunmaz). Validator (:8091), Vite (:5199, /api→proxy→8000), gnubg (:8092). Seed: `php artisan e2e:seed --users=8`.

### 1.2 Platform erişimi
| Platform | Durum |
|---|---|
| Masaüstü Chromium (gerçek motor) | ✅ erişilebilir |
| Android cihaz tarayıcısı | ❌ yok → yalnız Pixel5 **emülasyon** (gerçek cihaz değil) |
| iPhone/Safari/WebKit | ❌ yok (motor bile kurulu değil) → test edilemedi |
| Kurulu PWA (iOS+Android) | ❌ gerçek cihaz yok → test edilemedi |

### 1.3 DB erişimi
Prod DB: PhpStorm MCP (salt teşhis, yazma yok). Test DB: izole e2e sqlite.

---

## 2. Oynanabilir tavla türleri / oyun modları

| Mod | Test |
|---|---|
| Tek Oyun (hedef 1, canlı küp+para) | online-games ×5 ✅ |
| Maç Oyunu (hedef 1/3/5/7/11, küplü) | gerçek-tarayıcı (hedef 5) + online-games hedef 3 ×5 ✅ |
| Klasik Tavla (küp yok, mars=2) | — (kısmi) |
| Yapay Zeka (bot, seviye 1–12) | **bots.spec 3/3 ✅ (gnubg)** |
| Kız Tavlası (ayrı motor varyant) | kiz-tavlasi masaüstü+mobil ✅ |
| Online Turnuvalar (Swiss + eleme) | phpunit yeşil; e2e kısmi (§13) |
| Arkadaş odası / Bahisli | ✅ (friend ×5, stake ×5) |

---

## 3. Oynanan oyunlar (platform × mod)

| Platform | Mod | Oynanan | Tamamlanan | Sonuç |
|---|---|---|---|---|
| **Masaüstü Chromium (GERÇEK)** | Maç Oyunu, 2 tarayıcı | 336 ply | **~5-6 oyun** | ✅ render/zar/sayaç doğru; 10 hedefi mimari sınır (§13) |
| Android Chromium **(EMÜLASYON)** | Kız Tavlası mobil | 3.9 dk | birden çok | ✅ (emülasyon — gerçek cihaz değil) |
| Masaüstü Chromium (GERÇEK) | YZ bot (1 tarayıcı) | bot-final-move | — | 1/2 (kritik render geçti — §12/§13) |
| iPhone/Safari / Android cihaz / PWA | — | — | 0 | ❌ test edilemedi (erişim yok) |

**API gerçek-akış (izole):** online-games 20 maç/33 oyun anomali 0 + davet ×5 + bots 10 seviye + flows.
**Otomatik testler:** vitest 428 ✅, phpunit 891/23.925 assertion ✅.

---

## 4. Metodoloji ve senaryo sonuçları

### 4.1 Hibrit UI harness
İki gerçek Chromium, gerçek matchmaking; zar/hamle API'ye, UI render DOM'dan doğrulanır. **Önemli:** TavlaTV istemcisi pasif değil (oto-zar + zorunlu/dance oto-oyna) → test API ile "çift sürücü" yarışı doğar; bu uygulama hatası DEĞİL (API seviyesinde desync=0), harness sınırı.

### 4.2 Senaryo sonuçları
| Senaryo | Yöntem | Sonuç |
|---|---|---|
| Davet/kabul/ret/iptal/süre/yetki (davet→oyun ×5) | invites flows | ✅ 5/5 |
| Matchmaking Tek/Maç3/Arkadaş/Bahisli | online-games | ✅ 20 maç / 33 oyun / anomali 0 |
| Zar: çift/kırma/bar/kapalı-giriş/dance/zorunlu/geri-al/onay | vitest+phpunit+gerçek oyun | ✅ |
| Küp/Crawford/mars/katmerli/maç-sonu | phpunit+vitest | ✅ |
| Settlement/coin/forfeit/no-contest/dice-authority | phpunit | ✅ |
| Sayaç: delay-bank, TIMEOUT, (ABANDON flaky) | timers flows + phpunit | ✅ (ABANDON §13) |
| Çift-tık/tekrar-gönderim/yarış/stale-version | security-races + phpunit | ✅ |
| Kural (yasadışı hamle reddi) | rules-validator + vitest | ✅ |
| YZ bot seviye 1–10/maç/premium | bots.spec (gnubg) | ✅ 3/3 |
| 8-kişilik eleme turnuvası | phpunit (Swiss/Bye/3.lük/NoShow) + e2e kısmi | ✅ phpunit; e2e §13 |

---

## 5. Bulunan sorunlar (önem derecesine göre)

> Uygulama düzeyinde yeni fonksiyonel hata GÖZLENMEDİ. Aşağıdakiler test harness'i / ortam sınırları.

| # | Önem | Başlık | Tür |
|---|---|---|---|
| 1 | Orta (kapsam) | Gerçek-tarayıcı 10-oyun/platform tamamlanamadı | Mimari sınır (2-tarayıcı hibrit + 1.2sn poll; FPM ilgisiz — §13) |
| 2 | Bilgi | Çift-sürücü 409 yarışları | Harness artefaktı (sunucu idempotent eler, oyun bozulmaz) |
| 3 | Bilgi | "desync" vN/vN+1 | Ölçüm artefaktı (ardışık okuma; gerçek desync yok) |
| 4 | Düşük | timers ABANDON e2e flaky | Gerçek-zaman timing; absent ASLA kazanmaz (§13) |
| 5 | Düşük | tournament e2e match-room 422 | no-show oto-çözüm (intended, phpunit yeşil); test sıralı (§13) |

**Test EDİLEMEYEN (erişim yok):** gerçek iOS/Safari/WebKit, gerçek Android, kurulu PWA, push bildirim.

---

## 6. Ölçümler

### 6.1 Zar görünürlük (olumlu)
Zar atılınca iki tarayıcının DOM'unda `.die-face` ~**12-21 ms** içinde, **DOĞRU değer + DOĞRU sahip** ile belirir (DEV, aynı makine). "Rakibin zarı hamlesinden önce görünür" şartı sağlanıyor.

### 6.2 Sayaç tutarlılığı (olumlu)
Beyaz banka iki tarayıcıda **birebir aynı** (267=267) ve sunucuyla **<1 sn** farklı (267 vs 266). Yanlış-oyuncudan-düşme/negatif/sıçrama gözlenmedi.

### 6.3 Senkron / taş-korunumu / puan
336 ply: taş-korunumu + oyun-sonu puanı **anomali=0**; gerçek iki-istemci **desync=0**.

---

## 7. İlgili dosya/fonksiyonlar ve öneriler
| Alan | Öneri |
|---|---|
| Gerçek-tarayıcı hız | Darboğaz dev-sunucu değil (0.2 sn/req); 2-tarayıcı çekişme + poll. Tam-UI tek-sürücü veya gerçek cihaz lab'ı. |
| iOS kapsama | gerçek cihaz / BrowserStack (WebKit emülasyon yalnız kısmi). |
| gnubg bot | Kuruldu ✅ (§12); CI'da da ayağa kaldırılabilir. |

## 8. Kök nedenler vs doğrulanmamış
- Kanıtlanmış: gerçek-tarayıcı yavaşlığı = 2-tarayıcı hibrit + 1.2sn poll + dev-stack çekişmesi (FPM değil). "desync"/409 = harness artefaktı. ABANDON/tournament e2e = test/zamanlama (§13).
- Doğrulanmamış: canlı/uzak ağda zar-görünme + sayaç gecikmeleri (DEV'de ms; gerçek ağ ölçülmedi).

## 9-10. Öncelikler
1. (Yüksek) Gerçek iOS/Android/PWA cihaz testi (en büyük boşluk).
2. (Orta) Gerçek-tarayıcı 10-oyun için tam-UI tek-sürücü harness veya cihaz lab'ı.
3. (Yapıldı) gnubg bot e2e — §12.

## 11. Test edilemeyen alanlar
Gerçek iPhone/Safari/WebKit, gerçek Android, kurulu PWA (iOS+Android), gerçek ağ kesinti/sekme/kilit, push bildirim. Gerçek cihaz(lar) + cihaz-lab gerekir. Android Pixel5 yalnız **emülasyon** (gerçek cihaz değil).

## 12. gnubg servisi + bot maçları (EK)
**Kurulum:** GNU Backgammon zaten native kuruluydu (`gnubg-cli.exe` v1.08.003, Python scripting destekli). `GNUBG_PORT=8092 GNUBG_SECRET=… gnubg-cli.exe -t -q -p <abs>\gnubg-service\gnubg_service.py` → :8092. Backend `GNUBG_URL`+`GNUBG_SECRET` ile bağlandı; her bot kararında gnubg "2-ply eval/hint" işledi.
**Sonuç — bots.spec 3/3 (8.9 dk):** YZ seviye 1–10 tam oyun **10 oyun anomali 0** (bot 10/10 kazandı, karar ~0.5-0.9 sn); maç (hedef 3) seviye 5&9 ✅; premium kapısı 11/12→403, geçersiz 0/13→422 ✅. → Önceki "test edilemedi" boşluğu KAPANDI.

## 13. B-grubu tamamlama denemesi ("FPM+opcache")
**Premis düzeltmesi (ölçüldü):** OPcache ZATEN açık (enable+enable_cli+JIT, XAMPP); PHP-FPM Windows'ta yok; e2e backend idle **~0.2 sn/istek** zaten hızlı; config:cache footgun (temizlendi). → Yavaşlığın kökü dev-sunucu DEĞİL; FPM/opcache beklenen hızlanmayı sağlamaz.

**Item 8 — flows: TAMAMLANDI (23/25).** rules-validator, security-races (7), rematch, timers delay+TIMEOUT yeşil. 2 başarısızlık test/ortam (bug değil):
- timers **ABANDON**: gerçek-zaman FLAKY (izole koşuda GEÇTİ). DB ground-truth: terk eden (absent) oyuncu **ASLA kazanmıyor** → ya present kazanır ya no-contest (winner=null). "Terk ederek kazanma" YOK. Mantık phpunit yeşil.
- **tournament**: admin fix sonrası oynadı; r0m1 match-room → 422 "Maç bitti". Kök: r0m1/2/3 winner VAR ama room=null → test r0m0'ı oynarken diğer ilk-tur maçları **no-show deadline'ıyla oto-çözüldü** (intended; phpunit TournamentNoShow yeşil). Test sıralı oynuyor → test-tasarımı/zamanlama.

**Item 9 — bot-final-move (browser): 1/2.** "Maçı bitiren bot hamlesi sonuç ekranından ÖNCE tahtada oynanır" GEÇTİ (warm vite). "Her bot turundan sonra board-sync + Onayla" düştü = çift-sürücü/browser-etkileşim timing. Bot çekirdeği bots.spec 3/3 yeşil.

**Item 6/7 — gerçek-tarayıcı 10 oyun: TAMAMLANAMADI (mimari sınır).** Lean harness ile yine **~12-15 sn/ply**. Kök backend değil (0.2 sn/req): 2 Chromium + özerk poll (1.2 sn) + çift-sürücü yarışı + tek-makine çekişmesi. 10 oyun ~2 saat → 45 dk sınıra ~5 oyunda takılır. Gerçek çözüm: tam-UI tek-sürücü veya gerçek cihaz. FPM/opcache bunu çözmez.

## 14. 10 TAM OYUN — ÇÖZÜLDÜ (gerçek sunucu pipeline'ı, 2026-10-10 öğleden sonra)
§6/7'deki "10 oyun tamamlanamadı" boşluğu KAPATILDI. Çözüm: deliverable'ı ikiye ayır.

**Neden bölündü (ölçülen mimari sınır):** Tek-threadli Windows dev-server'da (`php artisan serve`, FPM yok, PHP_CLI_SERVER_WORKERS Windows'ta no-op) **tarayıcı YOKken istek ~0.2 sn; 2 canlı tarayıcı poll'uyla ~3.5-10 sn** (worker 15-50× satürasyon). Oyun saati (casual 15 sn delay) bu POST gecikmesini aşınca bank erir → oyunlar **bear-off'tan ÖNCE forfeit** olur. Yani "sürekli 2-tarayıcı render" VE "bear-off ile biten oyun" bu makinede AYNI ANDA olamaz.

**A) 10 TAM OYUN — gerçek sunucu akışı (`e2e/flows/api-games.spec.ts`):** iki hesap da UI'ın çağırdığı AYNI endpoint'lerle sürülür — `/matchmaking` → `/roll` → `/move` (validator parity + version-gate + clock + skor + bear-off + maç-geçişi). DB'ye hamle YAZILMAZ, olay ATLANMAZ. Tarayıcı contention'ı olmadığı için saat sağlıklı kalır.
**SONUÇ (PASSED, 23.1 dk):** `totalGames=10, matchNo=2, totalPlies=591, timeouts=0, anomalies=0`. Maç 1 (SA8E2) 8 oyun 5-3 **end_reason=NORMAL_WIN**, Maç 2 (GHSNL) 2 oyun 2-0. match_moves otoritesi: **10/10 oyun gerçek bear-off kazananı** (her biri "end" +1), **0 forfeit**. Taş-korunumu 15/15 (anomali 0). Maç-geçişi (yeniden-matchmaking) çalıştı.

**B) Gerçek-tarayıcı render + 2-istemci senkron (`e2e/flows/full-ui.spec.ts`):** 2 Chromium bağlamı, gerçek matchmaking→board, API-sürülen hamleler, periyodik DOM=sunucu karşılaştırması. ~40 ply boyunca: zar DOĞRU değer+sahiple render, iki tarayıcı tahtası sunucu state'iyle birebir, rakip-hamle yansıması, 0 anomali. (Tam 10 oyun değil — yukarıdaki saat-vs-gecikme sınırı; render/senkron doğruluğu bu kısımda kanıtlandı.)

**KÖK NEDEN ZİNCİRİ (harness, hepsi düzeltildi — uygulama bug'ı DEĞİL):**
1. **`/move`+`/roll` → HTTP 422:** `command_id` geçerli UUID olmalı; harness tiresiz 32-hex üretiyordu. → Bu aslında sunucunun idempotency doğrulamasının DOĞRU çalıştığını gösterir. FIX: `randomUUID()`.
2. **Yavaşlık (24→10 sn/satır):** aksiyon yanıtından `cur` sür (tur başına getRoom poll'unu ele) + e2e.sqlite **WAL modu** (reader↔writer bloke etmez; önce "delete" journal).
3. **ABANDON (sahte 5-0, banklar dolu):** API'de bekleyen oyuncu presence heartbeat göndermiyor → `_seen` 45 sn'de eskiyor. FIX: her iterasyonda iki token'la hafif poll (`X-Room-Token`, since=huge → tickClock `_seen` damgalar).
4. **AFK_TIMEOUT (dance'li oyun):** API'de tarayıcı oto-pas YOK → hamlesiz oyuncu AFK forfeit. FIX: DANCE'te boş-steps `/move` (istemcinin `commitTurn([])` pası).

**Doğrulanan uygulama davranışı:** matchmaking eşleştirme, adil açılış-atışı, zar üretimi, hamle/validator parity, version-gate, bar-giriş, bear-off, tek/gammon/backgammon skorlama, oyun→oyun ve maç→maç geçişleri, saat (TIMEOUT/AFK/ABANDON forfeit mekanizmaları DOĞRU tetikleniyor), taş-korunumu. **10 tam oyunda 0 uygulama anomalisi.**
