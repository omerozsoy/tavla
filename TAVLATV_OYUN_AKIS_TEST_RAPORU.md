# TavlaTV — Oyun Akışı Uçtan Uca Test Raporu

> Durum: **ÇALIŞMA SÜRÜYOR** — bu dosya test ilerledikçe güncellenir. Son bölümdeki "Nihai özet"
> yalnız gerçekten çalıştırılmış testlere dayanır.

## 1. Sürüm, ortam, tarih

| Alan | Değer |
|---|---|
| Tarih | 2026-10-04 |
| Başlangıç commit'i | `20775d7` (dal: `claude/cloud-session-credits-9nd4yl`, = `main`) |
| Ortam | Bulut konteyner (Linux), Node 22.22, PHP 8.3.6, Playwright Chromium 1194 (headless) |
| Backend | Laravel 12, `APP_ENV=e2e`, **ayrı SQLite** (`backend/database/e2e.sqlite`) — canlı veriye dokunulmadı |
| Validator | `validator/dist/server.mjs` (:8091) — backend'in hamle doğrulayıcısı |
| gnubg | Ubuntu paketi **GNU Backgammon 1.07.001** (:8092). Üretimde daha yeni derleme var; 1.07'de olmayan `gnubg.setgnubgid` için yalnız yerel kopyaya (depoya girmeyen) uyumluluk katmanı eklendi |
| Frontend | Vite dev (:5199), backend'e proxy |
| Test hesapları | `php artisan e2e:seed --users=8` → W, B, P3…P8 (yalnız e2e DB). W'ye yalnız e2e DB'de yönetici yetkisi verildi (turnuva açmak için) |

## 2. Keşfedilen oyun türleri ve giriş noktaları

| Oyun türü | Giriş noktası (istemci → sunucu) | Motor / doğrulama | Not |
|---|---|---|---|
| YZ'ye karşı (seviye 1–12) | `createBotRoom` → `POST /bot/rooms`; bot `maybeDriveBot`/`driveBot`, kurtarma `POST /rooms/{code}/bot` | Sunucu-otoriter; bot hamlesi gnubg (`BotMoveService`) | 11–12 yalnız Premium; `SERVER_BOT=true` (yerel YZ yolu kapalı) |
| Rastgele eşleşme — Tek Oyun | `POST /matchmaking` (`targets:[1]`, `stake`/`stakes[]`) | Sunucu-otoriter, validator | Bahisli: stake×48 rezerv, aynı anda tek bahisli maç |
| Rastgele eşleşme — Maç oyunu | `POST /matchmaking` (`targets:[3,5,…]`) | Sunucu-otoriter | Küp, Crawford |
| Arkadaş odası (kod) | `POST /rooms` + `POST /rooms/{code}/join` | Sunucu-otoriter | `mode=friendly`, hedef 1–25 |
| Davetle oyun | `POST /friends/{id}/invite` → `/rooms/{code}/enter` → davetli `/ping` → `POST /invites/{id}/respond` → `/enter` | Sunucu-otoriter | Davet `/ping`'de 2 dk görünür; 10 dk sonra silinir |
| Turnuva (eleme + Swiss) | `POST /tournaments`, `/join`, `/start`, `/match-room`, `/report` | Sunucu-otoriter odalar; rapor sunucu sonucuyla doğrulanır | Swiss (`swiss_triple`) kapalı olabilir |
| Kız Tavlası | `/kiz-tavlasi` (yalnız istemci, bilgisayara karşı) | `src/kiz/engine.ts`, `src/kiz/ai.ts` | Sunucu tarafı yok |
| Yerel (aynı cihaz) | `mode='pvp'` (App.tsx) | İstemci motoru | Sunucuya gitmez |
| İzleme / rövanş / terk | `/rooms/{code}/watch`, `/rematch`, `/leave` | — | Terk = hükmen kayıp |

Gerçek zamanlı: Reverb yayını yapılandırılmışsa WebSocket, değilse (e2e: `BROADCAST_CONNECTION=log`) 1.2 sn'lik **poll**.
Saat: `MatchClock` (banka/puan: casual 180, normal 60, speed 24 sn; gecikme 15/10/8 sn; AFK 60 sn; terk 45 sn).

## 3. Test yaklaşımı

- **API tam-akış (e2e/flows/*.spec.ts):** Test, gerçek istemci gibi `/roll` ve `/move` gönderir. Sunucunun döndürdüğü her durumu istemci TS motoruyla **bağımsız** denetler: her ply'da 15+15 taş, iki oyuncunun aynı sürüm/durumu görmesi, oyun bitişinde sunucu puanı = motor sonucu (tek/mars/katmerli) × küp, kaybedenin skorunun değişmemesi. Hamle seçimi tohumlu RNG ile tekrar üretilebilir.
- **Kontrollü kural senaryoları:** Sabit tahta + sabit zar, backend'in kullandığı **çalışan validator servisine** gönderilir. Üretime test kancası veya sabit zar eklenmedi.
- **Tarayıcı:** iki ayrı Chromium oturumu (masaüstü + Pixel 7 emülasyonu), UI'dan eşleşme; tahta DOM'u sunucu tahtasıyla karşılaştırılır.

(Ayrıntılı sonuçlar aşağıdaki bölümlerde, test bittikçe doldurulur.)
