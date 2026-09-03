"""Otomatik board kose tahmini (OpenCV). En buyuk 4-kose quad konturu.

ASLA zorunlu degil — frontend'e BASLANGIC koseleri olarak verilir; kullanici duzeltir.
Bulamazsa None -> frontend varsayilan ic-dikdortgen kullanir.
"""
import cv2
import numpy as np


def _order(pts: np.ndarray) -> list[tuple[float, float]]:
    """4 nokta -> TL,TR,BR,BL (toplam/fark ile)."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]
    return [tuple(tl), tuple(tr), tuple(br), tuple(bl)]


def detect_corners(bgr: np.ndarray) -> list[dict] | None:
    """Return [TL,TR,BR,BL] normalize (0..1) veya None."""
    h, w = bgr.shape[:2]
    scale = 900 / max(h, w)
    small = cv2.resize(bgr, (int(w * scale), int(h * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 40, 120)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    img_area = small.shape[0] * small.shape[1]
    best = None
    best_area = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.15 * img_area:  # cok kucuk -> board degil
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx) and area > best_area:
            best, best_area = approx.reshape(4, 2).astype(float), area
    if best is None:
        return None
    ordered = _order(best)
    sh, sw = small.shape[:2]
    keys = ["topLeft", "topRight", "bottomRight", "bottomLeft"]
    return [{"key": k, "x": float(x / sw), "y": float(y / sh)} for k, (x, y) in zip(keys, ordered)]
