"""Kup DEGERI = RapidOCR ile rakam okuma (8/16/32/64) — class-2 netlestirici.

Uretim recognition'da CubeClassify_v2 sinif-2 ("8 veya ustu") icinde 8/16/32/64 AYRIMI YOK
(digit_count sadece 8 vs 16 tahmini). Bu modul OCR ile tam degeri okur (etiketli fotoda 5/5):
  - EN iyi ROTASYON (0/90/180/270) + buyutme + CLAHE ile OCR.
  - DEGER KISITI: OCR cikisini {2,4,8,16,32,64} kumesine esle; bilinen karismalari duzelt.
  - CubeClassify sinif ipucu (class 2 -> {8,16,32,64}) ile belirsizligi daraltir.

rapidocr_onnxruntime KURULU DEGILSE modul sessizce devre disi (read_value -> None): uretim
digit_count fallback'ine duser, HICBIR SEY KIRILMAZ. OCR'i acmak = venv'e rapidocr ekle (provision).
Girdi: RGB kup kirpintisi (BGR gelirse cagiran cevirmeli)."""
import numpy as np
import cv2
from PIL import Image

VALUES = [2, 4, 8, 16, 32, 64]
_VSTR = {str(v): v for v in VALUES}
CLASS_SET = {0: {2, 4}, 1: {2, 4}, 2: {8, 16, 32, 64}}

_ENGINE = None
OCR_OK = None  # None=denenmedi, True/False=rapidocr var/yok


def _engine():
    global _ENGINE, OCR_OK
    if _ENGINE is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ENGINE = RapidOCR()
            OCR_OK = True
        except Exception:
            OCR_OK = False
            raise
    return _ENGINE


def available():
    """OCR kullanilabilir mi? (rapidocr_onnxruntime kurulu + yuklenebiliyor)"""
    global OCR_OK
    if OCR_OK is None:
        try:
            _engine()
        except Exception:
            pass
    return bool(OCR_OK)


def _prep(rgb):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return cv2.createCLAHE(3.0, (8, 8)).apply(g)


def _candidates(raw, score):
    digits = "".join(c for c in raw if c.isdigit())
    out = []
    if digits in _VSTR:
        out.append((_VSTR[digits], 1.0))
    if len(digits) == 1:
        d = digits
        if d == "7":
            out.append((2, 0.85))
        for v in VALUES:
            sv = str(v)
            if len(sv) == 2 and sv[-1] == d:
                out.append((v, 0.65))
    return [(v, w * score) for v, w in out]


def read_value(crop_rgb, class_hint=None):
    """Kup kirpintisindan DEGER oku. rapidocr yoksa (None, 0.0, {}) doner (fallback sinyali).
    Donus: (value int|None, conf 0..1 float, detail dict)."""
    if crop_rgb is None or getattr(crop_rgb, "size", 0) == 0:
        return None, 0.0, {}
    try:
        eng = _engine()
    except Exception:
        return None, 0.0, {"err": "no_ocr"}

    tokens = []
    for rot in (0, 90, 180, 270):
        r = crop_rgb if rot == 0 else np.asarray(Image.fromarray(crop_rgb).rotate(rot, expand=True))
        res, _ = eng(_prep(r))
        for box, txt, sc in (res or []):
            b = np.asarray(box, np.float32)
            area = abs(cv2.contourArea(b))
            digits = "".join(c for c in txt if c.isdigit())
            tokens.append((txt, float(sc), area, len(digits) >= 2))

    vscore, vmeta = {}, {}
    for raw, sc, area, md in tokens:
        for v, w in _candidates(raw, sc):
            if w > vscore.get(v, 0.0):
                vscore[v] = w
                vmeta[v] = (area, md, raw)
    if not vscore:
        return None, 0.0, {"tokens": [(t, round(s, 2)) for t, s, _, _ in tokens]}

    hint_set = CLASS_SET.get(class_hint)

    def rank(v):
        s = vscore[v]
        if hint_set is not None:
            s *= 1.3 if v in hint_set else 0.7
        area, md, _ = vmeta[v]
        return (round(s, 3), 1 if (md and s > 0) else 0, area)

    best = max(vscore, key=rank)
    conf = min(1.0, vscore[best] * (1.3 if (hint_set and best in hint_set) else 1.0))
    detail = {"value": best, "ocr_raw": vmeta[best][2], "class_hint": class_hint,
              "all": {v: round(vscore[v], 2) for v in sorted(vscore)}}
    return best, round(conf, 2), detail
