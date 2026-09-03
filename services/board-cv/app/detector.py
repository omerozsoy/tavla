"""Checker dedektorleri. Ortak arayuz: warped board -> pul tespitleri.

- YoloDetector: egitilmis Ultralytics YOLO modeli (models/checkers.pt varsa). ASIL cozum.
- ColorDetector: modelsizken OpenCV renk-segmentasyon fallback (kaba; yiginlarda zayif).

Her tespit: Checker(cls, conf, cx, cy, w, h) — koordinatlar NORMALIZE (0..1).
cls: 'light' (=beyaz=+) | 'dark' (=siyah=-).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Protocol

import cv2
import numpy as np

MODEL_PATH = os.environ.get("BOARD_CV_MODEL", "models/checkers.pt")


@dataclass
class Checker:
    cls: Literal["light", "dark"]
    conf: float
    cx: float  # normalize 0..1
    cy: float
    w: float
    h: float


class Detector(Protocol):
    source: str
    def detect(self, warped_bgr: np.ndarray) -> list[Checker]: ...


class YoloDetector:
    """Egitilmis model varsa yukler. Sinif 0=light, 1=dark (dataset/data.yaml ile ayni)."""
    source = "yolo"

    def __init__(self, model_path: str = MODEL_PATH):
        from ultralytics import YOLO  # lazy import (agir)
        self.model = YOLO(model_path)

    @staticmethod
    def available(model_path: str = MODEL_PATH) -> bool:
        return os.path.isfile(model_path)

    def detect(self, warped_bgr: np.ndarray) -> list[Checker]:
        h, w = warped_bgr.shape[:2]
        res = self.model.predict(warped_bgr, verbose=False)[0]
        out: list[Checker] = []
        for b in res.boxes:
            x1, y1, x2, y2 = b.xyxy[0].tolist()
            cls_idx = int(b.cls[0])
            out.append(Checker(
                cls="light" if cls_idx == 0 else "dark",
                conf=float(b.conf[0]),
                cx=((x1 + x2) / 2) / w, cy=((y1 + y2) / 2) / h,
                w=(x2 - x1) / w, h=(y2 - y1) / h,
            ))
        return out


class ColorDetector:
    """OpenCV fallback: koyu (siyah) + parlak-doygun (kirmizi/acik) segmentasyon.

    Renk-BAGIMSIZ degil (kirmizi/siyah'a yakin varsayimlar); YOLO gelene kadar KABA.
    Yiginlari tek blob gorup EKSIK sayabilir -> confidence dusuk isaretlenir.
    """
    source = "opencv"

    def detect(self, warped_bgr: np.ndarray) -> list[Checker]:
        h, w = warped_bgr.shape[:2]
        hsv = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2HSV)
        H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        dark = (V < 70).astype(np.uint8)
        light = (((H < 12) | (H > 168)) & (S > 120) & (V > 110)).astype(np.uint8)
        k = np.ones((5, 5), np.uint8)
        out: list[Checker] = []
        for mask, cls in ((light, "light"), (dark, "dark")):
            m = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
            n, _, stats, cents = cv2.connectedComponentsWithStats(m, connectivity=8)
            area_one = (w / 12) * (h * 0.10)  # kabaca tek pul alani
            for i in range(1, n):
                a = stats[i, cv2.CC_STAT_AREA]
                if a < area_one * 0.4:
                    continue
                cx, cy = cents[i]
                bw = stats[i, cv2.CC_STAT_WIDTH] / w
                bh = stats[i, cv2.CC_STAT_HEIGHT] / h
                out.append(Checker(cls=cls, conf=0.5, cx=cx / w, cy=cy / h, w=bw, h=bh))  # type: ignore[arg-type]
        return out


def get_detector() -> Detector:
    if YoloDetector.available():
        try:
            return YoloDetector()
        except Exception:
            pass
    return ColorDetector()
