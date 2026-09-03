"""YOLOv8n egitimi — tavla pul dedektoru. CPU'da bile baslar; GPU varsa otomatik kullanir.

Kullanim:
    pip install ultralytics
    python train.py                # varsayilan
    python train.py --epochs 100 --imgsz 1280

Cikti: runs/detect/train/weights/best.pt -> models/checkers.pt olarak kopyala.
"""
import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--imgsz", type=int, default=1280)  # board detayi icin buyuk
    ap.add_argument("--model", default="yolov8n.pt")     # hafif; n->s->m ile buyutulebilir
    ap.add_argument("--batch", type=int, default=8)
    args = ap.parse_args()

    here = Path(__file__).parent
    model = YOLO(args.model)
    # Gercekci telefon-fotografi augmentasyonu (data.yaml disi, egitim-anli)
    model.train(
        data=str(here / "data.yaml"),
        epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        degrees=8, perspective=0.0006, translate=0.06, scale=0.25,
        hsv_h=0.02, hsv_s=0.5, hsv_v=0.4, fliplr=0.0, mosaic=1.0,
        project=str(here / "runs"), name="train", exist_ok=True,
    )
    best = here / "runs" / "train" / "weights" / "best.pt"
    dst = here.parent / "models" / "checkers.pt"
    if best.exists():
        shutil.copy(best, dst)
        print(f"Model kopyalandi -> {dst}")


if __name__ == "__main__":
    main()
