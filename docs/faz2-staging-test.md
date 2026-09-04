# Faz 2 — 2-İstemci Staging Test Rehberi

Faz 2 (tam sunucu-otoriter: zar+hamle+tahta+skor+küp+saat) canlıda **AÇILMADAN** önce yalnız
2 test hesabıyla doğrulanır. Global kapalı kalır; sadece allow-list'teki çift authoritative olur.

## Kurulum (env)
Backend `.env`:
```
SERVER_AUTHORITATIVE_USERS=<senin_user_id>,<test_user_id>
# SERVER_AUTHORITATIVE=false  (global KAPALI kalsın; sadece bu çift test eder)
VALIDATOR_URL=https://validator.tavlai.com   (zaten var — validator-check valid:true doğruladı)
VALIDATOR_SECRET=<validator ile aynı>
VALIDATOR_REQUIRED=true
```
Sonra: Plesk **Git → Deploy** (ya da `php artisan config:clear`). İki tarayıcıda **Ctrl+Shift+R**.

User ID'ler: `/admin` → Kullanıcılar → ID sütunu.

## Test (iki tarayıcı: normal + gizli)
Her iki hesapla **Maç Oyunu / Hızlı Eşleşme** → aynı bahis + uzunluk → eşleş. Sonra:

1. **Açılış** — iki tarafta da açılış zarı gelir, yüksek atan başlar (asla çift/berabere). Takılma yok.
2. **Hamle + sıra** — başlayan oynar → **sıra karşıya geçer** → karşı taraf zar atıp oynar. Karşılıklı akar.
3. **Zar hilesi kapalı** — (devtools'la denesen bile) istemci zar değeri seçemez; sunucudan gelir.
4. **Vuruş / bar / bear-off** — pul vur, rakip bar'dan girsin, taş topla.
5. **Saat** — SADECE sıradaki oyuncunun süresi sayar; diğerininki durur. AFK/süre-bitimi doğru tarafta.
6. **Küp** — zar atmadan önce küp teklif et → rakip **kabul (×2, küp devreder)** / **pas (oyun biter)**.
   Küp beklerken zar atılamaz. Skor doğru.
7. **Crawford** (uzun maçta) — biri (target-1)'e ulaşınca sonraki oyunda küp teklif edilemez.
8. **Oyun/Maç sonu** — bir oyun bitince skor artar, yeni oyun açılışı gelir; maç bitince kazanan +
   coin/rating (settle server_match'ten — forge edilemez).
9. **Pes (resign)** — pes eden kaybeder, rakip küp değerince kazanır.
10. **Refresh (F5)** — oyun kaldığı yerden gelir (poll server_state'i uygular).
11. **Reconnect** — bir tarafın interneti kısa kesilir/gelir → poll ile senkron olur.

## Hata olursa
Artık hata toast'ları **gerçek sebebi** yazar (ör. "Geçersiz hamle", "Sıra sende değil").
Ekran görüntüsü + mesajı ilet. Backend uçtan uca testli (AuthoritativeLoopTest, 188 yeşil),
o yüzden kalan sorunlar çoğunlukla frontend gösterim/senkron detayı olur.

## Test temizse — canlıya aç
- `SERVER_AUTHORITATIVE=true` (önce yalnız staked/para maçları) → Deploy → gözlem.
- Sorun → anında geri: `SERVER_AUTHORITATIVE=false` (+ users boşalt) → Deploy.
- **Geçici `/api/validator-check` ucunu KALDIR** (rota + RoomController::validatorCheck).

## Bilinen v1 sınırları (açmadan not)
- Küp çok-oyunlu maçta saat/segment yaklaşımı: kenar durumlar (küp-pending anı) yaklaşık.
- Oyun-sonu ara ekranı authoritative'de kısa (sunucu yeni oyuna hızlı geçer).
- beaver/otomatik-çift YOK (kasıtlı).
