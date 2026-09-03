# Dataset — Tavla Pul Tespiti (YOLO)

Amaç: tepeden-düz (perspektif düzeltilmiş) board görüntülerinde **her pulu** kutu olarak
tespit eden bir YOLO modeli eğitmek. Sınıflar: `checker_light` (0), `checker_dark` (1).

## Klasör yapısı
```
dataset/
  images/train/  images/val/     # .jpg
  labels/train/  labels/val/     # YOLO .txt (aynı isim)
  data.yaml
  train.py
```

## Görüntüler nasıl olmalı
- **Perspektif düzeltilmiş** (tepeden-düz) board — canlıda `BoardPhotoWarp`'ın ürettiği
  görüntünün aynısı. Böylece eğitim ↔ inference dağılımı tutar.
- Toplarken ham telefon fotoğrafını `BoardPhotoWarp` (veya `app/perspective.py`) ile
  düzleştirip kaydet. **Farklı** board/ışık/açı/yığın çeşitliliği şart.
- Başlangıç: ~50-100 görüntü (train), ~15-20 (val). Büyüdükçe isabet artar.

## Etiketleme (annotation)
Her pula BİR kutu. Üst üste (stack) pulları **ayrı ayrı** kutula — asıl zorluk bu; dataset'e
1,2,3,4,5,6+ yığın örnekleri koy. Kutu = pulun görünen dairesi.

YOLO `.txt` formatı (her satır bir pul, normalize 0..1):
```
<class> <cx> <cy> <w> <h>
0 0.31 0.12 0.06 0.09      # light
1 0.68 0.85 0.06 0.09      # dark
```

**Önerilen araç:** [Roboflow](https://roboflow.com) (tarayıcı, kolay, YOLO export) veya
`labelImg` / `CVAT`. Sınıf adlarını `checker_light`, `checker_dark` yap; export "YOLOv8".

## Renk vs sınıf
Sınıf **açık/koyu** (light/dark), renk değil — kırmızı/siyah, beyaz/siyah, mavi/krem vb.
tüm boardlarda "iki gruptan açık olanı = light". Etiketlerken hep **açık ton = 0**.

## Eğitim
```
pip install ultralytics
python train.py --epochs 80 --imgsz 1280
# çıktı: runs/train/weights/best.pt -> otomatik models/checkers.pt'ye kopyalanır
```
Model `../models/checkers.pt`'ye konunca servis (detector.py) otomatik YOLO'ya geçer.

## Fixture testleri
`../tests/fixtures/position_00X.jpg` + beklenen `position_00X.json` (engine points[24]).
`../tests` altındaki testler tespiti beklenen ile karşılaştırır.
