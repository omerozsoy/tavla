# Gece Denetimi — 2026-09-06 (A'dan Z'ye kontrol + test)

İki bağımsız denetim ajanı (oturum-değişiklikleri incelemesi + güvenlik/para denetimi) + tam test/build.

## Test durumu — HEPSİ YEŞİL
- Backend: **215 test / 6875 assertion** ✓
- Frontend: **155 test** ✓
- Build: temiz ✓ (yalnız chunk-size uyarısı — eskiden beri var, hata değil)

## ✅ Bu gece DÜZELTTİM (commit 72ffb95, para/rating akışına DOKUNMADAN)
1. **Luck job DEDUP** — iki oyuncu aynı anda raporlayınca çift gnubg analizi oluyordu; iki satır da doluysa artık atlar.
2. **Queue nabız okuma** — `services:watch` nabzı yazıyordu ama okumuyordu; artık okuyor (boştayken ölü worker'ı da yakalar).
3. **gnubg regex** — işaret opsiyonel (`[+-]?`); işaretsiz sıfır/format varyantına dayanıklı.
4. **Alert TTL** — uzun kesintide günde bir fazladan uyarı yağmuru fix'i.
> Deploy notu: gnubg regex → **gnubg-analysis restart**; job dedup → **tavla-queue restart**.

---

## 🔴 SENİN KARARIN gereken (KASITLI dokunmadım — para/rating kritik)

### C1 — Eşzamanlı bahisli maçlarda escrow yok (KRİTİK, KOD)
Coin yalnız maç BAŞINDA kontrol ediliyor, **rezerve edilmiyor**. Saldırgan 1000 coin'le aynı anda N maça girip hepsini kaybederse, `settle`'daki `min(amount, bakiye)` mint'i önler AMA her dürüst kazanan tek bakiyeden **pay** alır (eksik ödenir). Ya da colluding çift, hedef maçtaki gerçek kazananı başka maçla bakiyeyi boşaltıp eksik ödetebilir.
- **Fix:** Maç başında iki oyuncunun bahsini atomik olarak (lockForUpdate) bir pot'a/`coins_reserved`'a **rezerve et**; bakiye < bahis ise maçı reddet. Settle pot'u kazanana öder. Alternatif: kullanıcı başına tek aktif bahisli oda.
- **Not:** Kapalı testte düşük risk; canlıya/halka açmadan ÖNCE şart.

### #1 — Log truncation uzun maçta luck merge'i bozar (YÜKSEK, KOD)
İstemci `matchLogRef.slice(-250)` gönderiyor. Çok-oyunlu uzun maçta (7/11-puan) erken oyunların açılış işaretleri kırpılınca `MatBuilder` oyunları yanlış böler → gnubg'ye bozuk `.mat` → MWC luck **sessizce yanlış**. Kısa maçlarda (1-puan test) sorun YOK.
- **Fix:** Online maçta tam log gönder (ör. `slice(-250)` → `slice(-800)` veya kırpma yok), YA DA her girişe `gameNo` ekleyip sunucuda ona göre böl.
- **Not:** Frontend değişikliği + rebuild gerektirir; depolama biraz artar (1.2MB limit içinde). Kapalı testte kısa maçlar için acil değil.

### M1 — Oda silinince rating şişirme (ORTA, KOD)
Oda `updated_at < 1 gün` silindikten sonra oyuncu `opponent_rating:4000` + `ranked:true` ile puanlı kazanç raporlayabilir (oda yoksa istemci değerine düşülüyor).
- **Fix:** `room_code`'lu ranked raporda oda/kalıcı-maç-kaydı ŞART; `opponent_rating` + `ranked` sunucudan türet. Maç-sonu metadata'yı kalıcı sakla (cleanup silmesin).

### M2 — reportRating idempotency yarışı (ORTA, KOD)
`(room_code, user_id)` üzerinde unique index yok; hızlı çift-gönderim iki satır (çift Elo) oluşturabilir.
- **Fix:** `match_results(room_code, user_id)` unique index (nullable hariç) + check/insert'i lockForUpdate transaction'a al.
- **Not:** Migration mevcut dup satırlarda patlayabilir → önce dedupe gerekir (o yüzden otomatik yapmadım).

### H1 — DEMO ödeme bedava-coin musluğu (YÜKSEK ama CONFIG)
`PAYMENT_DEMO=true` + Garanti yapılandırılmamışken `fulfillDemo()` banka olmadan coin yükler. Kod doğru; risk operasyonel.
- **Fix:** Canlıda Garanti yapılandır (demo'yu sertçe kapatır) VEYA `PAYMENT_DEMO` unset. Öneri: `APP_ENV=production` iken `isDemo()` tamamen reddet.

### M3 — Garanti mdstatus 1–4 kabul (ORTA, banka-teyit)
3D-secure'da genelde yalnız `1` tam doğrulanmış. Hash kontrolü forge'u önler; risk chargeback sorumluluğu.
- **Fix:** Garanti ile merchant config'inde hangi mdstatus'ların liability-shift taşıdığını teyit et; gerekmezse `1`'e (gerekiyorsa `2`) daralt.

### Düşük/bilgi
- L: Oda `token` istemci-seçimli bearer (sızarsa griefing); `deleteAccount` payment kayıtlarını cascade siler (muhasebe/AML boşluğu); public `validator-check` teşhis ucu (kaldır); avatar 300KB/log 1.2MB depolama-abuse levers; gnubg import hatası sessiz (luck null, alarm yok — #3).

---

## ✅ SAĞLAM doğrulandı (güven verici)
- **Bahisli kazanan forge edilemez** — staked'de kazanan yalnız `server_match.done`'dan; istemci `won`/`state` güvenilmiyor.
- **Settle atomik + idempotent + sıfır-toplam** — tek `settled` flag claim, lockForUpdate, `min(amount,bakiye)` mint önler.
- **DICE_ENFORCE=true ile zar hilesi kapalı** — commit-reveal + mismatch reddi (zar-mismatch logu TEMİZ).
- **Hamle yasallığı sunucu-doğrulamalı, fail-closed** (validator erişilemezse ret).
- **Ödeme tutarı sunucu-otoriter** — fiyat config'ten, callback hash+tutar doğrulamalı, idempotent.
- **Mass-assignment kapalı** — rating/coins/is_admin/email_verified_at fillable dışı.
- **Auth/authorization** — para + /me/* sanctum arkasında; admin çift-gate; SiteGate tüm /api'de; login/reset throttle.
- **Validator authoritative PR ÇALIŞIYOR** (bu gece test edildi — sinir ağıyla sunucuda).
- **MatBuilder ↔ TS buildMat BİREBİR** (assertSame parite testi); luck renk-yönelimi (p0=white/p1=black) uçtan uca doğru.
- **500-hook + Queue::failing hook** — beklenen hataları atlar, istek akışını bozmaz, spam-limitli.

---

## Öncelik sırası (sabah)
1. **C1 escrow** (halka açmadan önce ŞART) — kod işi, birlikte tasarlayalım.
2. **#1 log truncation** — uzun maç oynanacaksa; kısa maç testinde acil değil.
3. **M2 unique index** — hızlı, güvenli (önce dedupe).
4. **M1 rating inflation** — orta.
5. Deploy: gnubg-analysis + tavla-queue restart (bu geceki fix'ler için).
