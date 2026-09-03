# Board-CV Microservice

Fotoğraftan tavla pozisyonu okuma — **bağımsız** Python servisi (oyun motoruna dokunmaz).
Laravel arkasında (proxy) çalışır; internete doğrudan açılmaz.

## Akış
`foto + 4 köşe → perspektif düzeltme (OpenCV) → checker detect (YOLO varsa, yoksa OpenCV fallback) → point assignment (geometry) → tavla kural doğrulama → confidence → JSON`

## Kanonik koordinat
Engine ile aynı: `points[i]` = hane `i+1`; **+ = açık (light/beyaz), − = koyu (dark/siyah)**.
Geometri `app/geometry.py` = `src/ui/boardGeometry.ts`'in birebir aynası (tek gerçek kaynak: frontend).

## API
`POST /detect-position` (multipart)
- `image`: dosya
- `corners`: JSON `{"topLeft":{"x","y"},"topRight":{...},"bottomRight":{...},"bottomLeft":{...}}` (normalize 0..1)

Yanıt (engine-uyumlu + review):
```json
{
  "success": true,
  "points": [0,0,-2,...],            // 24 int, +açık/-koyu
  "bar": {"white":0,"black":1},
  "off": {"white":0,"black":0},      // fotodan bilinemez -> 0 (uydurulmaz)
  "dice": null,
  "detection": {"confidence":0.86,"needsReview":false,"needsReviewPoints":[],"source":"yolo","errors":[]}
}
```
`GET /health` → `{ok, detector: "yolo"|"opencv"}`.

## Çalıştırma (geliştirme)
```
pip install -r requirements.txt
uvicorn app.main:app --port 8091 --reload
```

## Çalıştırma (sunucu — Docker)
```
docker compose up -d --build      # 127.0.0.1:8091'de dinler
```
Sadece localhost'a bağla; Laravel `BOARD_CV_URL=http://127.0.0.1:8091` ile çağırır.

## Model
`models/checkers.pt` varsa YOLO, yoksa OpenCV fallback (kaba). Model: `dataset/` → `train.py`.

## Test
```
pip install pytest
pytest
```
