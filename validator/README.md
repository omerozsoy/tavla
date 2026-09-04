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
- `POST /analyze-pr` `{hc, log}` → `{pr, decisions}`. **Sunucu-otoriter PR**: `hc` oyuncusunun her
  kararını (log'daki `pos`+`dice`+`playedSteps`) sinir ağıyla YENİDEN değerlendirir; en iyi hamle
  ile oynanan hamlenin equity farkını (loss) ortalayıp ×500 → PR. İstemcinin gönderdiği `loss`'a
  güvenmez. Featurization (`encoding.ts`) + model dosyaları istemciyle AYNI → equity paritesi.

## Güvenlik
- **ASLA halka açık portta çalıştırma.** Yalnız localhost + backend erişmeli.
- `VALIDATOR_SECRET` set edilirse `x-validator-secret` başlığı zorunlu (backend gönderir).
- Gövde 1MB ile sınırlı.

## Derleme
```
npm run validator:build   # -> validator/dist/server.mjs + dist/models/{contact,race}.onnx
```
Bundle + modeller commit'lenir; sunucuda derlemeye gerek yok. Motor (`src/engine`) inline'dır;
tek runtime bağımlılığı **onnxruntime-node** (PR analizi için — native modül, bundle EDİLEMEZ).

## PR analizi için kurulum (onnxruntime-node)
PR'ı sunucu-otoriter yapmak (`/analyze-pr`) için validator'a native ONNX runtime gerekir:
```
cd validator && npm i          # onnxruntime-node kurar (prebuilt binary)
```
Modeller `validator/dist/models/` altında bundle ile gelir; farklı yerdeyse `MODELS_DIR` env ver.

## Çalıştırma (Plesk / Node)
```
VALIDATOR_PORT=8090 VALIDATOR_SECRET=<uzun-rastgele> node validator/dist/server.mjs
```
Plesk: Node.js uygulaması olarak ekle (application startup file = `validator/dist/server.mjs`),
env: `VALIDATOR_PORT`, `VALIDATOR_SECRET`. Passenger süreci ayakta tutar.

## Backend bağlama
`backend/.env`: `VALIDATOR_URL=http://127.0.0.1:8090`, `VALIDATOR_SECRET=<aynı>`.
- Hamle: RoomController `POST {URL}/validate` ile doğrular; erişilemezse para/ranked maçta hamle
  **REDDEDİLİR** (fail-closed).
- PR: `VALIDATOR_PR_MODE=off|shadow|authoritative`. `shadow` → sunucu PR'i hesaplanıp istemciyle
  farkı loglanır (kaydedilmez, doğrulama aşaması). `authoritative` → sunucu PR'i kaydedilir
  (istemci loss'una güvenilmez); validator yoksa istemci-türevi PR'a düşer (fail-open, PR istatistik).
  **Öneri: önce `shadow` ile logdaki farkı ~0 gör, sonra `authoritative`e geç.**
