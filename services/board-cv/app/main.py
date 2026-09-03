"""Board-CV microservice (FastAPI). Foto + kose -> engine-uyumlu pozisyon.

Akis: perspektif duzeltme -> checker detect (YOLO varsa, yoksa OpenCV) ->
point assignment -> tavla kural dogrulama -> confidence -> JSON.

Guvenlik: bu servis ic aga acilir; internetten dogrudan erisilebilir olmamali.
Laravel (PhotoDetectController) auth + throttle + upload guvenligi ile onune gecer.
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .assign import assign
from .detector import get_detector
from .gamestate import empty_off, to_bar, to_points_array
from .perspective import corners_valid, warp_from_corners
from .rules import validate
from .schema import BarCount, DetectResponse, Detection

app = FastAPI(title="Tavlai Board-CV", version="0.1.0")

MAX_BYTES = int(os.environ.get("BOARD_CV_MAX_BYTES", 12 * 1024 * 1024))
CONF_REVIEW = 0.75  # altinda "kontrol et"


@app.get("/health")
def health():
    from .detector import YoloDetector
    return {"ok": True, "detector": "yolo" if YoloDetector.available() else "opencv"}


@app.post("/detect-corners")
async def detect_corners_ep(image: UploadFile = File(...)):
    """Auto kose TAHMINI (best-effort). Bulamazsa corners:null -> frontend manuel stub.
    ASLA zorunlu degil; kullanici her zaman elle duzeltir."""
    from .board_detect import detect_corners
    raw = await image.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya cok buyuk.")
    corners = detect_corners(_decode(raw))
    return {"corners": corners}


def _decode(raw: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=422, detail="Gorsel cozulemedi.")
    return img


def _parse_corners(corners_json: str) -> list[tuple[float, float]]:
    try:
        c = json.loads(corners_json)
        order = ("topLeft", "topRight", "bottomRight", "bottomLeft")
        pts = [(float(c[k]["x"]), float(c[k]["y"])) for k in order]
    except Exception:
        raise HTTPException(status_code=422, detail="Gecersiz kose verisi.")
    if not corners_valid(pts):
        raise HTTPException(status_code=422, detail="INVALID_CORNER_GEOMETRY")
    return pts


@app.post("/detect-position", response_model=DetectResponse)
async def detect_position(image: UploadFile = File(...), corners: str = Form(...)):
    raw = await image.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya cok buyuk.")
    bgr = _decode(raw)
    pts = _parse_corners(corners)

    warped = warp_from_corners(bgr, pts)
    detector = get_detector()
    checkers = detector.detect(warped)

    points, bar, assign_conf, review_points = assign(checkers)
    errors, light_total, dark_total = validate(points, bar)

    overall = assign_conf
    if errors:
        overall = min(overall, 0.4)
    needs_review = overall < CONF_REVIEW or bool(review_points) or bool(errors)

    return DetectResponse(
        success=len(errors) == 0,
        points=to_points_array(points),
        bar=BarCount(**to_bar(bar)),
        off=BarCount(**empty_off()),
        dice=None,  # Phase 6
        detection=Detection(
            confidence=round(overall, 3),
            needsReview=needs_review,
            needsReviewPoints=sorted(review_points),
            source=detector.source,
            errors=errors,
        ),
    )
