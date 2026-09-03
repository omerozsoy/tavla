# Tavla Move Validator (sunucu-otoriter hamle doğrulama)

Para maçı güvenliği **Faz 2**. Mevcut TS motorunu (`src/engine`) yeniden kullanan küçük bir
Node servisi. PHP backend her hamleyi buraya sorar; yasadışıysa reddeder → istemci hile yapamaz.
TS motoru tek gerçek kaynak olduğu için PHP↔TS mantık sapması olmaz.

## Uçlar
- `GET /health` → `{ok:true}` (secret'siz).
- `POST /validate` `{state, steps}` → `{valid, state?, reason?}`. `state`: otoriter durum (zar dolu),
  `steps`: istemcinin önerdiği tam-tur. Yasalsa uygulanmış yeni `state` döner.
- `POST /legal-moves` `{state}` → `{moves}` (tüm yasal tam-tur hamleleri; sunucunun turu bitti mi /
  dance mı bilmesi için).

## Güvenlik
- **ASLA halka açık portta çalıştırma.** Yalnız localhost + backend erişmeli.
- `VALIDATOR_SECRET` set edilirse `x-validator-secret` başlığı zorunlu (backend gönderir).
- Gövde 1MB ile sınırlı.

## Derleme
```
npm run validator:build   # -> validator/dist/server.mjs (motor inline, sıfır runtime bağımlılığı)
```
Bundle commit'lenir; sunucuda derlemeye gerek yok.

## Çalıştırma (Plesk / Node)
```
VALIDATOR_PORT=8090 VALIDATOR_SECRET=<uzun-rastgele> node validator/dist/server.mjs
```
Plesk: Node.js uygulaması olarak ekle (application startup file = `validator/dist/server.mjs`),
env: `VALIDATOR_PORT`, `VALIDATOR_SECRET`. Passenger süreci ayakta tutar.

## Backend bağlama (sonraki adım)
`backend/.env`: `VALIDATOR_URL=http://127.0.0.1:8090`, `VALIDATOR_SECRET=<aynı>`.
RoomController hamleyi `POST {VALIDATOR_URL}/validate` ile doğrular; validator erişilemezse
para/ranked maçta hamle **REDDEDİLİR** (fail-closed).
