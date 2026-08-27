# World Backgammon Council (Dünya Tavla Konseyi)

Tarayıcıda çalışan, yapay sinir ağı destekli tavla oyunu. React + TypeScript + Vite.

## Özellikler

- **Güçlü bot:** [wildbg](https://github.com/carsten-wenderdel/wildbg) sinir ağı, tarayıcıda `onnxruntime-web` (WASM) ile çalışır — sunucu gerekmez.
- **İki bot seviyesi:** Sinir Ağı (wildbg) ve hızlı heuristik.
- **Analiz paneli:** Kazanma olasılığı, equity, en iyi hamleler, gnubg tarzı hata sınıflandırması.
- **Küp (doubling cube):** Teklif/kabul/pas, Crawford kuralı, maç skoru (1/3/5/7 puan).
- **Etkileşim:** Tek tıkla oyna veya sürükle-bırak; birleşik hamleler; zar sırası değiştirme.
- **Kişiselleştirme:** Koyu/açık tema, 8 board renk teması, TR/EN dil desteği.
- **Üyelik + otomatik kayıt:** Yerel profil ve oyun kaydı (yarım kalmaz).

## Kurulum

```bash
npm install
npm run dev      # http://localhost:5173
```

## Komutlar

```bash
npm run dev        # gelistirme sunucusu
npm run build      # production build (once tsc -b tip kontrolu)
npm run typecheck  # yalnizca tip kontrolu
npm run lint       # oxlint
npm test           # vitest (yalnizca src/**)
```

## Backend (Laravel API)

`backend/` altinda Laravel 12 + Sanctum + Filament yonetim paneli. Frontend `VITE_API_URL`
ile bu API'ye baglanir (tanimsizsa ayni origin).

```bash
cd backend
composer install
cp .env.example .env            # sonra .env'i doldur (asagi bak)
php artisan key:generate
php artisan migrate              # (uretimde: --force)
php artisan serve                # http://127.0.0.1:8000
php artisan test                 # backend testleri (sqlite :memory:)
```

**Onemli .env degiskenleri:**
- `ADMIN_EMAILS` — yonetici e-postalari (virgulle). **Uretimde MUTLAKA doldur**; kaynak
  koda gomulu admin yoktur, bos ise panel/admin API'ye kimse erisemez.
- `GOOGLE_CLIENT_ID` — Google Sign-In (gizli degil).
- `GARANTI_*` — Garanti Sanal POS 3D odeme (banka verir; bos ise odeme kapali).
- `VITE_API_URL` (frontend .env) — API taban adresi.

## Deploy (tavlai.com — Plesk, tek domain)

Document root = `backend/public`. **Frontend sunucuda derlenmez** — derlenmis cikti repoya
commit'lenir:

```bash
npm run deploy:build     # build + dist -> backend/public (commit hatirlatir)
git add backend/public && git commit && git push
# Plesk: git pull -> deploy.sh (composer install, filament:assets, migrate --force, optimize:clear)
```

> Sik hata: yalnizca `src/*` commit etmek canliyi DEGISTIRMEZ — `backend/public` de commit'lenmeli.

## Yapı

- `src/engine/` — tavla kurallari, hamle uretimi, sinir agi motoru (saf TypeScript, test kapsamli)
- `src/ui/` — tahta, zarlar, analiz paneli, kayit formu
- `src/boardThemes.ts` — board tema tanimlari (App.tsx'ten cikarildi)
- `public/models/` — wildbg ONNX agirliklari (contact/race)
- `src/ort/` — onnxruntime-web WASM dosyalari (offline calismasi icin)
- `backend/` — Laravel API (auth, oda/matchmaking, turnuva, magaza, odeme)

## CI

`.github/workflows/ci.yml`: her push/PR'da frontend (typecheck+lint+test+build) ve
backend (composer + phpunit) calisir.

## Lisans

Sinir agi modelleri wildbg'den (MIT/Apache). Proje kodu kisisel/egitim amacli.
