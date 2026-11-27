# Fotoğraftan Pozisyon Tanıma Servisi

Tavla tahtası fotoğrafını **yapısal pozisyona** çevirir (`points[24]`, bar, dice).
gnubg analizi AYRI: mevcut `gnubg-service` yapısal konumu alıp hint döner.

## Boru hattı (`recognize.py`)
```
foto → Board_v1 seg maske → perspektif warp (STRETCH) → CheckerDice tespit
     → x-kümeleme → renk (HSV doygunluk S<130) → standart hane numaralama
     → DieClassify zar → {points[24], bar, turn, dice, cube}
```
5 TFLite modeli `tensor-models/` (gitignore, ~43MB). Öz-denetim değişmezleri `debug.valid`:
`placed==checkers`, renk≤15, karışık_hane=0 — sağlanmazsa pozisyon güvenilmez (UI yeniden-çek).

## Uçlar (`service.py`)
- `GET /health` → `{"ok":true}` (secret'siz)
- `POST /recognize[?flip=1]` ham foto byte'ları → tanıma JSON (header `x-recog-secret` şart)

## Yerel çalıştırma/test
```bash
python -m venv .venv && .venv/bin/pip install ai-edge-litert opencv-python numpy
RECOG_SECRET=test RECOG_PORT=8095 .venv/bin/python recognition/service.py
curl -s -H "x-recog-secret: test" --data-binary @foto.jpeg http://127.0.0.1:8095/recognize
```

## Sunucu deploy (Forge — KULLANICI tetikler)
1. **Env provizyonu:** `sudo -n -u tavla bash scripts/provision-recognition.sh`
   (shared/recognition altında Python 3.12 venv + ai-edge-litert + opencv; deploy'da silinmez).
2. **Modelleri yükle** (gitignore, repoda yok): `tensor-models/*.tflite` →
   `/home/tavla/tavlatv.com/shared/recognition/tensor-models/` (scp/rsync).
3. **Daemon:** Forge panel > Daemons (bkz `recognition.service` şablonu). `RECOG_SECRET`'i
   backend `.env`'teki `RECOG_SECRET` ile AYNI yap.
4. **Doğrula:** `curl 127.0.0.1:8095/health` + bir test fotoğrafı POST.

## Backend bağlama (Faz 3 — Laravel)
Foto upload → kuyruk → tanıma → gnubg zinciri `backend/`'de bağlı:
- `config/recognition.php` + `RecognitionClient` (bu servise HTTP; GnuBgClient deseni)
- `AnalyzePhotoJob` (**ayrı `photo` kuyruğu** — canlı kuyruğu aç bırakma, bkz backend/CLAUDE.md)
- `PhotoAnalysisController` + routes: `POST /api/photo-analysis` (upload) + `GET /api/photo-analysis/{id}` (poll)
- Filament `Foto Analizleri` paneli (Oyun grubu) — kalibrasyon incelemesi
- `PhotoAnalysisTest` (3 test ✓)

**Deploy (KULLANICI):**
1. `php artisan migrate --force` (photo_analyses tablosu — deploy.sh zaten çalıştırır)
2. backend `.env`: `RECOG_URL=http://127.0.0.1:8095` + `RECOG_SECRET=<servis ile AYNI>`
3. **`photo` kuyruğu worker'ı** (Forge Daemon; CLAUDE.md: her kuyruk ayrı worker, starvation):
   `php artisan queue:work database --queue=photo --sleep=3 --tries=3 --timeout=120 --max-time=3600`
   (Forge panel > Daemons; User=tavla, Directory=.../current/backend). Worker yoksa işler kuyrukta bekler.

## ⚠ Açık uçlar (Faz 2 kalan)
- **gnubg round-trip doğrulama:** yapısal konum → `gnubg-service` `structured_to_gnubgid` → hint.
  MUTLAK yönelim + `turn` + renk→oyuncu KONVANSİYONU burada kesinleşir (foto doğal yön belirsizliği).
  Gerekirse `?flip=1` + renk-swap toggle. Açılış pozisyonu fotoğrafıyla doğrulanmalı.
- Aykırı foto sağlamlaştırma (bazı fotolarda barcenter tahmini kayıyor → `valid=false`).
- Küp değeri (CubeClassify 3-sınıf anlamı app-özel; şimdilik cube=1/merkezi).
