# TavlaTV — Tüm Oyunlar Test Raporu

## Nihai özet ve tamamlanma durumu

**Durum:** TAMAMLANDI (kapsam sınırlı) — çalıştırılabilir kalite, tam-stack, responsive ve zar testleri tamamlandı; 5 tam oyun, PvB UI, yerel UI ve turnuva oyunları tamamlanamadı.

**Nihai sonuç:** 370/370 çalıştırılan birim testi geçti (1 test skip); typecheck/build/lint başarılı; authoritative online smoke başarılı; zar testleri 3/3 başarılı; responsive 71 başarılı, 1 flaky, 1 başarısız; 5 tam oyun denetimi harness timeout nedeniyle başarısız. Kritik işlevsel bulgu: yok. Öncelikli açık bulgular: mobil `.bug-fab` 0px ve E2E cold-start/timeouts.

Bu rapor, proje ana dizinindeki tek test/ilerleme/sonuç kaydıdır. Bulgular silinmeden kronolojik olarak biriktirilecektir. Nihai özet testler tamamlandığında bu bölümün başında güncellenecektir.

## Test kapsamı ve başlangıç envanteri

**Tarih:** 2026-10-04  
**Çalışma dizini:** `C:\Users\Master\PhpstormProjects\tavla`  
**Test cihazları/hedefleri:** Playwright Chromium Desktop Chrome; mevcut otomasyon tanımında 1280×720; responsive tanımında 320×640, 390×844, 768×1024 ve 1440×900; ayrıca cihaz profili Pixel 7. Gerçek fiziksel cihaz testi bu çalışmada henüz yapılmadı.

### Keşfedilen oyun modları

1. **PvB / YZ’ye karşı oyun** — yerel veya sunucu-otoriter bot akışı; bot zorlukları 1–10.
2. **Yerel oyun** — iki kişinin aynı cihazda oynadığı akış.
3. **Online / gerçek rakibe karşı oyun** — matchmaking/oda akışı.
4. **Maç oyunu** — hedef puanlı online maç; E2E tanımında 5 puanlık maç.
5. **Kız Tavlası** — ayrı kural motoru ve `/kiz-tavlasi` akışı.
6. **Turnuva akışları** — turnuva katılımı/maç ekranı olarak keşfedildi; tam oyun yürütme testi ayrıca doğrulanacak.
7. **Kız Tavlası alt akışları** — iki kişi ve bilgisayara karşı oynama seçenekleri kaynak metninde mevcut; yalnız motor doğrulandı.

### Beklenen test kanıtları

- Otomatik test çıktıları, konsol/ağ/sunucu loglarının gerekli bölümleri ve sonuç özetleri bu dosyaya yazılacak.
- Ekran görüntüsü gerekiyorsa `test-kanitlari/` altında tutulacak ve ilgili bulguya bağlanacak.
- `test-results/` mevcut Playwright çalışma çıktıları olabilir; rapora yalnız gerekli kanıt özeti alınacaktır.

## İlerleme günlüğü

### 2026-10-04 — başlangıç

- Paket komutları ve Playwright yapılandırmaları incelendi.
- Mevcut E2E kapsamı: smoke, authoritative iki oyuncu, responsive, zar görünürlüğü ve beş tam online oyun denetimi.
- Oyun motoru için Vitest testleri ve Kız Tavlası motor testleri mevcut.
- Deterministik kalite kapıları çalıştırıldı ve başarıyla tamamlandı.
- Tam-stack smoke + authoritative E2E çalıştı: authoritative doğrudan, smoke retry ile geçti; Playwright exit 0.

### 2026-10-04 — tam-stack smoke/authoritative kanıtı

- **Authoritative:** başarılı; backend + validator + Vite süreçleri Playwright tarafından başlatıldı. 2 oyuncu eşleşti, beyaz ve siyah en az bir hamle yaptı ve sıra alternatif döndü.
- **Smoke:** retry ile başarılı. İlk denemede `http://localhost:5199/` için `page.goto` 45.000 ms `load` timeout; retry başarılı.
- **Konsol/sunucu logu:** E2E seed aşamasında test SQLite migration'ları tamamlandı; validator Node süreçlerinde yalnız `NO_COLOR`/`FORCE_COLOR` uyarısı görüldü.
- **Kanıt dosyası:** [Playwright smoke hata bağlamı](test-results/smoke-app-render-oluyor-smoke--chromium/error-context.md) ve retry trace'i mevcut.
- 5 oyunluk UI denetimi çalıştırıldı ancak tamamlanamadı: ilk navigasyonda `domcontentloaded` 45 sn timeout, retry'da 120 sn test timeout; retry trace'i kesik ZIP olarak üretildi.
- Responsive matrisi tamamlandı: 73 yatay taşma/dokunma senaryosunda 71 geçti, 1 flaky oldu, 1 başarısız oldu. Başarısız testte 390px/Pixel 7 lobi `.bug-fab` yüksekliği 0px ölçüldü (beklenti ≥42px).

## Genel sonuç ve kritik hatalar

Henüz kesin sonuç yok; test yürütmesi devam ediyor.

## Senaryo sonuçları

| ID | Senaryo | Durum | Kanıt / not |
|---|---|---|---|
| S-01 | Birim ve motor testleri | BAŞARILI | Vitest: 39 dosya geçti, 1 dosya skip; 370 geçti, 1 skip; exit 0 |
| S-02 | TypeScript tip kontrolü ve üretim build'i | BAŞARILI | `npm run typecheck` exit 0; `npm run build` exit 0; Vite build tamamlandı |
| S-03 | Lint | BAŞARILI (uyarılarla) | `npm run lint` exit 0; mevcut warning'ler BULGU-001/002'de kayıtlı |
| S-04 | Uygulama smoke açılışı | BAŞARILI (flaky) | 1 retry ile geçti; ilk denemede `page.goto` 45 sn load timeout |
| S-05 | Authoritative online: beyaz ve siyah hamle/sıra dönüşü | BAŞARILI | 2 oyuncu eşleşti; beyaz ve siyah hamle yaptı; sıra dönüşü geçti |
| S-06 | 5 puanlık maçta 5 tam oyun ve iki istemci state eşitliği | BAŞARISIZ | İlk `page.goto` 45 sn timeout; retry test timeout 120 sn. Oyun başlayamadı, tamamlanan oyun 0. |
| S-07 | PvB bot seviyeleri 1–10 | BAŞARILI (motor) | `src/botPr.test.ts` 1–10 aralığını doğruladı; tam UI oyunu TEST EDİLEMEDİ |
| S-08 | Yerel oyun | TEST EDİLEMEDİ | Ayrı UI senaryosu ile doğrulanacak |
| S-09 | Kız Tavlası | BAŞARILI (motor) | `src/kiz/engine.test.ts` dahil genel Vitest içinde geçti; UI akışı TEST EDİLEMEDİ |
| S-10 | Responsive kritik rotalar ve mobil dokunma hedefleri | BAŞARISIZ | 71 passed, 1 flaky, 1 failed; `.bug-fab` 390px mobilde 0px |
| S-11 | Zar görünürlüğü / board stilleri | BAŞARILI | `playwright.dice.config.ts`: 3/3 geçti |

## Sayılar ve test matrisi

- Tamamlanan oyun sayısı: **0** (authoritative testi yalnızca iki hamlelik smoke döngüsüdür; 5 tam oyun testi henüz başlamadı).
- Denenen bot seviyeleri: **motor düzeyinde 1–10** (`src/botPr.test.ts`); tam oyun UI'sinde hiçbir seviye tamamlanamadı.
- Tamamlanan UI oyunları: **0**. Authoritative smoke'ta 2 oyuncu birer hamle yaptı; bu tam oyun sayılmadı.
- Kullanılan cihazlar: Playwright headless Chromium Desktop Chrome; UI audit hedefi 1280×720; responsive 320×640, 390×844, 768×1024, 1440×900; dokunma testi Pixel 7 profili. Gerçek fiziksel cihaz kullanılmadı.

## Hatalar

Henüz oyun kuralı veya authoritative hamle kabulü hatası doğrulanmadı. Aşağıdaki bakım, harness ve UI bulguları doğrulandı.

### BULGU-001 — Büyük üretim JavaScript chunk uyarısı

- **Önem:** P2 / performans ve ilk yükleme riski; işlevsel kırılma kanıtı yok.
- **Tekrar üretme:** Proje kökünde `npm run build` çalıştır.
- **Beklenen:** Build'in tamamlanması; kritik ilk yükleme chunk'larının tercihen daha küçük olması.
- **Gerçekleşen:** Build başarılı; Vite `index-DNtSvrOy.js` chunk'ını 912.42 kB (gzip 268.93 kB) olarak bildirdi ve 500 kB üzeri chunk uyarısı verdi.
- **İlgili dosyalar:** Build import zinciri; başlıca uygulama giriş alanı `src/App.tsx`.
- **Tespit edilen neden:** Üretim chunk sınırı aşılıyor; doğrudan işlevsel etki bu turda ölçülmedi.
- **Öneri:** P2 — rota/özellik bazlı lazy import ve code-splitting planı çıkarılsın; sonraki performans testinde LCP/JS transferi ölçülsün.

### BULGU-002 — Lint'te mevcut React Hook/Fast Refresh ve tip uyarıları

- **Önem:** P2 / bakım ve regresyon riski; lint exit 0, test kırılması yok.
- **Tekrar üretme:** Proje kökünde `npm run lint` çalıştır.
- **Beklenen:** Uyarısız lint.
- **Gerçekleşen:** Exit 0; `src/App.tsx` içinde eksik `useEffect` bağımlılıkları (`user`, `online`, `afkLeft`, `rewardSecs`), karmaşık dependency ifadeleri; çeşitli UI dosyalarında `react(only-export-components)` ve scriptlerde `no-explicit-any` uyarıları var.
- **İlgili dosyalar:** `src/App.tsx`, `src/ui/CheckerSkin.tsx`, `src/ui/ContentView.tsx`, `src/ui/*.tsx`, `scripts/*.ts`.
- **Tespit edilen neden:** Statik analiz kurallarının mevcut kod kalite borcunu uyarı seviyesinde raporlaması; gerçek runtime etkisi ayrıca doğrulanmadı.
- **Öneri:** P2 — önce `src/App.tsx` hook bağımlılıkları güvenli biçimde gözden geçirilsin; ardından Fast Refresh ve `any` uyarıları kademeli temizlensin.

### BULGU-003 — Smoke açılışında ilk denemede 45 saniye load timeout

- **Önem:** P1/P2 sınırı — E2E flaky başlangıç ve soğuk Vite yükleme riski; retry başarılı olduğu için kesin kullanıcı kırılması kanıtlanmadı.
- **Tekrar üretme:** `npx playwright test e2e/smoke.spec.ts e2e/authoritative.spec.ts --reporter=line` çalıştır; smoke ilk denemesi `page.goto('/')`.
- **Beklenen:** İlk navigasyonun `load` olayına 45 saniye içinde ulaşması.
- **Gerçekleşen:** İlk smoke denemesi 45.000 ms sonunda `page.goto` timeout; Playwright retry başarılı ve genel exit 0.
- **İlgili dosyalar:** `e2e/smoke.spec.ts`, `playwright.config.ts`; Vite dev server ilk derleme/asset yükleme zinciri.
- **Tespit edilen neden:** Bu turda kesinleştirilemedi; loglar cold Vite startup/derleme gecikmesiyle uyumlu.
- **Öneri:** P1 — smoke için `waitUntil: 'domcontentloaded'` veya ayrı navigation timeout stratejisi değerlendir; P2 — üretim preview ile stabil smoke ve cold-start metriği ekle.

### BULGU-004 — Beş tam oyun UI denetimi test harness timeout'u

- **Önem:** P1 / tam oyun regresyon kanıtı alınamıyor.
- **Tekrar üretme:** `npx playwright test e2e/ui-five-game-audit.spec.ts --reporter=line` çalıştır.
- **Beklenen:** İki Chromium istemcisi açılır, 5 puanlık maçta 5 oyun tamamlanır ve her hamlede iki istemcinin `server_state`/versiyon eşitliği doğrulanır.
- **Gerçekleşen:** İlk denemede `pages[1].goto('/', { waitUntil: 'domcontentloaded' })` 45 sn timeout; retry'da test toplam 120 sn timeout. Test oyun kurulumuna ve oyun döngüsüne ulaşmadı; tamamlanan oyun 0.
- **İlgili dosyalar:** `e2e/ui-five-game-audit.spec.ts`, `playwright.config.ts`; kanıt: [hata bağlamı](test-results/ui-five-game-audit-UI-audit-iki-test-hesabı-ile-beş-tam-oyun-chromium/error-context.md), [ilk trace](test-results/ui-five-game-audit-UI-audit-iki-test-hesabı-ile-beş-tam-oyun-chromium/trace.zip).
- **Tespit edilen neden:** Kesinleştirilemedi; iki istemci + üç web server cold start yüküyle uyumlu. Retry trace'i tamamlanamadığı için uygulama içi kök neden kanıtlanamadı.
- **Öneri:** P1 — bu denetimi üretim preview veya önceden ısıtılmış Vite hedefiyle ayır; iki sayfayı paralel `goto` et; navigasyon/test timeout'larını cold-start'tan bağımsız yapılandır; sonra 5 tam oyunu yeniden çalıştır.

### BULGU-005 — Mobil hata bildirimi FAB'ı görünür dokunma hedefi sağlamıyor

- **Önem:** P1 / mobil erişilebilirlik ve hata bildirimi kullanılabilirliği.
- **Tekrar üretme:** `npx playwright test e2e/responsive.spec.ts --reporter=line`; `@390 lobi kontrol boyutları` senaryosunu çalıştır.
- **Beklenen:** Mobil 390px/Pixel 7 profilinde `.bug-fab` yüksekliği en az 42px.
- **Gerçekleşen:** `.bug-fab` bulundu ancak `getBoundingClientRect().height = 0`; test iki denemede de aynı nedenle başarısız oldu. Aynı responsive koşusunda yatay taşma testleri geçti.
- **İlgili dosyalar:** `e2e/responsive.spec.ts`; `.bug-fab` bileşeni/stilleri için `src/` içinde ilgili selector aranmalı.
- **Tespit edilen neden:** 390px genişlikte misafir akışında `src/ui/bugReport.css` içindeki `@media (max-width: 720px) .bug-fab-guest { display: none; }` kuralı FAB'ı gizliyor; test yine `.bug-fab` ölçtüğü için yükseklik 0 dönüyor. Kod yorumu, bunun yerine üst barda `.ab-bug-flag` gösterileceğini söylüyor; test sözleşmesi ile ürün davranışı uyuşmuyor.
- **Öneri:** P1 — `.bug-fab` render koşulu, `display/visibility/height` CSS'i ve mobil menü/lobi koşulları incelensin; 390px Playwright testi düzeltme sonrası yeniden koşulsun.

## Varsayımlar, engeller ve tamamlanamayan testler

- E2E yapılandırması backend, validator ve Vite süreçlerini kendi başlatacak şekilde tasarlanmış görünmektedir; ortam bağımlı başlatma veya seed sorunu çıkarsa logu burada tutulacaktır.
- Gerçek cihaz, gerçek kullanıcı hesabı ve üretim para/ödül akışı bu çalışma kapsamına kendiliğinden dahil değildir; açıkça test edilebildiği ölçüde ayrıca belirtilecektir.

## Öncelik sırasına göre önerilen düzeltmeler

1. **P2 —** Büyük üretim chunk'ını lazy loading/code-splitting ile küçült.
2. **P2 —** Hook dependency ve lint uyarılarını güvenli refactor ile temizle.
3. **P1 —** `.bug-fab` mobil görünürlük/dokunma hedefi uyumsuzluğunu düzelt ve 390px testini yeniden çalıştır.
4. **P1 —** 5 tam oyun E2E'sini cold-start'tan izole et, ardından 5 oyun ve iki istemci eşitliği testini yeniden çalıştır.
5. **P2 —** Yerel, PvB UI (1–10), Kız Tavlası UI ve turnuva oyunları için ayrı kısa E2E senaryoları ekle.

## Ham kanıtlar ve loglar

### Kalite kapısı log özeti — 2026-10-04

```text
npm test -- --reporter=dot
Test Files  39 passed | 1 skipped (40)
Tests       370 passed | 1 skipped (371)
EXIT:0

npm run typecheck
tsc -b
EXIT:0

npm run build
vite v8.1.5 ... 6600 modules transformed ... built in 10.88s
EXIT:0

npm run lint
EXIT:0
Warnings: React Hook exhaustive-deps, only-export-components, no-explicit-any,
no-unused-vars/no-unused-expressions and large chunk warning-related maintenance notes.

npx playwright test --config=playwright.dice.config.ts --reporter=line
3 passed (4.3s)
EXIT:0

npx playwright test e2e/responsive.spec.ts --reporter=line
71 passed, 1 flaky, 1 failed (5.5m)
Failure: @390 lobi kontrol boyutları — .bug-fab height 0, expected >=42.
Flaky: @320 /(lobi) first navigation timeout, retry passed.
EXIT:1

npx playwright test e2e/ui-five-game-audit.spec.ts --reporter=line
Failure: first page.goto domcontentloaded timeout 45s; retry test timeout 120s.
Completed games: 0.
EXIT:1

npx playwright test e2e/smoke.spec.ts e2e/authoritative.spec.ts --reporter=line
1 passed + 1 flaky retry passed; authoritative passed.
Smoke first navigation timeout 45s, retry passed.
EXIT:0
```
