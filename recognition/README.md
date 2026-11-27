# Fotoğraftan Pozisyon Tanıma Servisi

Tavla tahtası fotoğrafını **yapısal pozisyona** çevirir (`points[24]`, bar, dice).
gnubg analizi AYRI: mevcut `gnubg-service` yapısal konumu alıp hint döner.

## Boru hattı (`recognize.py`)
```
foto → Board_v1 seg maske → aday warp'lar (gerçek-4-köşe perspektif | minAreaRect) [× 90° dönük,
       yalnız normal yönde geçerli yoksa] → CheckerDice tespit → x-kümeleme → renk (k-means S,V)
     → HANE IZGARASI UYDURMA (_fit_lattice: bar merkezi + aralık + bar genişliği, tüm kümeler
       birlikte; çarpışma/taşma cezası) → DieClassify zar → {points[24], bar, turn, dice, cube}
Geçerli adaylardan ızgaraya en iyi oturan (en düşük RMS `fit`) seçilir.
```
5 TFLite modeli `tensor-models/` (gitignore, ~43MB). Öz-denetim değişmezleri `debug.valid`:
`placed==checkers`, renk≤15, karışık_hane=0 — sağlanmazsa pozisyon güvenilmez (UI yeniden-çek).

## Uçlar (`service.py`)
- `GET /health` → `{"ok":true}` (secret'siz)
- `POST /recognize[?flip=1]` ham foto byte'ları → tanıma JSON (header `x-recog-secret` şart)

## Yerel çalıştırma/test
```bash
python -m venv .venv && .venv/bin/pip install ai-edge-litert opencv-python numpy
RECOG_SECRET=test RECOG_PORT=8120 .venv/bin/python recognition/service.py
curl -s -H "x-recog-secret: test" --data-binary @foto.jpeg http://127.0.0.1:8120/recognize
```

## Sunucu deploy (Forge — KULLANICI tetikler)
1. **Env provizyonu:** `sudo -n -u tavla bash scripts/provision-recognition.sh`
   (shared/recognition altında Python 3.12 venv + ai-edge-litert + opencv; deploy'da silinmez).
2. **Modelleri yükle** (gitignore, repoda yok): `tensor-models/*.tflite` →
   `/home/tavla/tavlatv.com/shared/recognition/tensor-models/` (scp/rsync).
3. **Daemon:** Forge panel > Daemons (bkz `recognition.service` şablonu). `RECOG_SECRET`'i
   backend `.env`'teki `RECOG_SECRET` ile AYNI yap.
4. **Doğrula:** `curl 127.0.0.1:8120/health` + bir test fotoğrafı POST.

## Backend bağlama (Faz 3 — Laravel)
Foto upload → kuyruk → tanıma → gnubg zinciri `backend/`'de bağlı:
- `config/recognition.php` + `RecognitionClient` (bu servise HTTP; GnuBgClient deseni)
- `AnalyzePhotoJob` (**ayrı `photo` kuyruğu** — canlı kuyruğu aç bırakma, bkz backend/CLAUDE.md)
- `PhotoAnalysisController` + routes: `POST /api/photo-analysis` (upload) + `GET /api/photo-analysis/{id}` (poll)
- Filament `Foto Analizleri` paneli (Oyun grubu) — kalibrasyon incelemesi
- `PhotoAnalysisTest` (3 test ✓)

**Deploy (KULLANICI):**
1. `php artisan migrate --force` (photo_analyses tablosu — deploy.sh zaten çalıştırır)
2. backend `.env`: `RECOG_URL=http://127.0.0.1:8120` + `RECOG_SECRET=<servis ile AYNI>`
3. **`photo` kuyruğu worker'ı** (Forge Daemon; CLAUDE.md: her kuyruk ayrı worker, starvation):
   `php artisan queue:work --queue=photo --sleep=2 --tries=3 --timeout=120 --max-time=3600`
   (bağlantı BELİRTME → varsayılan kullanılır; üretimde QUEUE_CONNECTION=**redis**. `queue:work
   database` YAZMA — dispatch varsayılana gider, database worker redis kuyruğunu görmez → işlenmez.)
   (Forge panel > Daemons; User=tavla, Directory=.../current/backend). Worker yoksa işler kuyrukta bekler.

## Kendini geliştiren döngü — etiket/eval seti (Option A)
Kullanıcı "Hatalı tarama bildir" → admin panelde (Filament, Oyun > Foto Analizleri) foto + görsel
editörle doğru konumu işaretler (`ground_truth`). Bu etiketler tanımayı **ölçmek** için kullanılır
(model EĞİTİMİ DEĞİL — tanıma 5 sabit GammonSnap TFLite + elle geometri; asıl hata kaynağı geometri):

1. **Export (sunucuda):** `sudo -n -u tavla php artisan photo:export-labels`
   → `ground_truth != null` kayıtların görseli + `labels.jsonl` (`{file,flip,ground_truth}`) `recognition/eval-data/`'ya (gitignore).
2. **Skorla:** `python eval.py eval-data` → `N foto · M TAM doğru (%..) · nokta hata ort ..` + başarısız her fotonun sapması.
   Birincil metrik `points[24]`+`bar`; `dice`/`turn` ikincil; `cube` kıyaslanmaz (model okumaz).
3. **İyileştir:** geometri (`_fit_lattice`/yönelim/barcenter) değiştir → `eval.py`'ı tekrar koş: gerileme
   yok + düzeldi mi bak. Böylece her düzeltilen foto bir regresyon testi olur.
4. **Otokalibre (Faz 3):** `python calibrate.py eval-data` → geometri sabitlerini (params.py: `k_center`,
   `k_prior_w`, `collision_w`...) küçük joint ızgarada **k-fold CV** ile tarar. Yeni set YALNIZCA ortalama
   exact-match +%5 İYİ **ve hiçbir fold gerilemiyorsa** `params.json`'a yazılır (az-veri overfit kalkanı);
   aksi halde dosyaya DOKUNMAZ. Üretime almak: `params.json` → `shared/recognition/` + daemon restart.
   `params.json` YOKKEN davranış bugünküyle BİREBİR (varsayılanlar eski sabitler).
5. **Teşhis:** `eval.py` çıktısındaki `basarisizlik modu -> yonelim:N sayi:N bar:N diger:N` satırı, **Faz 1**'in
   (yönelim sınıflandırıcısı) ne zaman gerektiğini gösterir — "yönelim" baskınsa ayrı plan turu açılır.
   (Faz 3 yalnız ızgara/kümeleme sabitlerini ayarlar; yönelim kodda ayarlanabilir eşik değil → Faz 1.)

Saf fonksiyonlar (`params`, `compare_position`, `kfold_split`, `accept_params`, `classify_failure`) modelsiz
→ `python -m pytest test_params.py test_calibrate.py test_eval.py`. `recognize` importu gereken davranış
testi (`test_recognize_params.py`) venv'de koşar.

## ⚠ Açık uçlar (Faz 2 kalan)
- **gnubg round-trip doğrulama:** yapısal konum → `gnubg-service` `structured_to_gnubgid` → hint.
  MUTLAK yönelim + `turn` + renk→oyuncu KONVANSİYONU burada kesinleşir (foto doğal yön belirsizliği).
  Gerekirse `?flip=1` + renk-swap toggle. Açılış pozisyonu fotoğrafıyla doğrulanmalı.
- ~~barcenter kayması~~ (2026-11-27 düzeltildi): eski "dolu haneler arası en büyük boşluk ortası"
  bara bitişik haneler boşken barı kaydırıp bir yarıyı 1 hane kaydırıyordu → uç gruplar aynı haneye
  clamp'lenip zıt renkler birbirini SİLİYORDU (placed 30→26). Izgara uydurma + gerçek-köşe warp ile
  canlı 16 fotoda geçerli 7→15, kontrol edilen 12'si birebir doğru.
- Kalan: tahta kadrajı TAM doldurursa seg maskesi görüntü kenarına dayanır → köşe = görüntü köşesi →
  warp'ta bir yarı sıkışır (fwzMw6: tek grup 1 hane kaydı, valid görünür). Çözüm UI'da: kılavuz
  çerçeveli kamera (src/ui/PhotoCamera.tsx) tahtanın etrafında boşluk bıraktırır.
- Fazla tespit (32 taş = tepsi/çerçeve FP) hâlâ `valid=false`.
- Küp değeri (CubeClassify 3-sınıf anlamı app-özel; şimdilik cube=1/merkezi).
