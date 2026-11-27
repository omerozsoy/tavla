"""Fotograftan tavla pozisyonu tanima — konsolide pipeline (Faz 1 prototiplerinden).
recognize(bgr) -> {points[24], bar, turn, dice, cube, debug}  (gnubg-service'e hazir yapisal konum).

Boru hatti: Board_v1 seg maske -> warp (STRETCH sart) -> CheckerDice -> x-kumeleme
-> renk (HSV doygunluk) -> standart hane numaralama -> DieClassify zar.
Oz-denetim degismezleri debug'da: tas=30, renk 15/15, karisik_hane=0.

Modeller bir kez yuklenir (singleton); invoke tek-thread -> _LOCK ile korunur.
"""
import os, threading
import numpy as np
import cv2
from ai_edge_litert.interpreter import Interpreter

MODELS = os.environ.get("RECOG_MODELS_DIR", "tensor-models")
Wd, Hd = 1000, 800
GAP = 40                 # ayni satirda bu kadar yakin taslar = ayni hane
COLOR_S_THRESH = 130     # HSV doygunluk: < beyaz, >= kirmizi (ampirik, 15/15 degismeziyle dogrulandi)
WHITE_COLOR = "W"        # hangi tas-rengi "beyaz" oyuncu (konvansiyon)
_LOCK = threading.Lock()


def _load(name):
    it = Interpreter(model_path=os.path.join(MODELS, name)); it.allocate_tensors()
    return it


_M = {}


def _get(name):
    if name not in _M:
        _M[name] = _load(name)
    return _M[name]


def _run(name, bgr, in_hw, stretch=False):
    """model-adi, bgr, (H,W) -> (ciktilar listesi, r, (px,py)). stretch=True letterbox YOK."""
    it = _get(name); inp = it.get_input_details()[0]
    H, W = bgr.shape[:2]
    if stretch:
        canvas = cv2.resize(bgr, (in_hw[1], in_hw[0])); r = 1.0; px = py = 0
    else:
        r = min(in_hw[0] / H, in_hw[1] / W); uw, uh = int(W * r), int(H * r)
        px, py = (in_hw[1] - uw) // 2, (in_hw[0] - uh) // 2
        canvas = np.full((in_hw[0], in_hw[1], 3), 114, np.uint8)
        canvas[py:py + uh, px:px + uw] = cv2.resize(bgr, (uw, uh))
    x = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    it.set_tensor(inp["index"], np.expand_dims(x, 0).astype(inp["dtype"])); it.invoke()
    outs = [it.get_tensor(o["index"]) for o in it.get_output_details()]
    return outs, r, (px, py)


def _warp(bgr):
    """Board_v1 seg -> en guvenli tahta -> perspektif warp (Wd x Hd). STRETCH preprocessing sart."""
    H, W = bgr.shape[:2]
    outs, _, _ = _run("Board_v1.tflite", bgr, (640, 640), stretch=True)
    det, protos = outs[0][0], outs[1][0]       # [37,8400], [160,160,32]
    a = int(det[4].argmax()); conf = float(det[4, a])
    m = (1 / (1 + np.exp(-(protos.reshape(-1, 32) @ det[5:37, a])))).reshape(160, 160)
    binm = (cv2.resize(m, (W, H)) > 0.5).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None, conf
    rect = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
    src = cv2.boxPoints(rect).astype(np.float32)
    s_ = src.sum(1); d_ = np.diff(src, 1).ravel()
    ordered = np.array([src[np.argmin(s_)], src[np.argmin(d_)], src[np.argmax(s_)], src[np.argmax(d_)]], np.float32)
    Mw = cv2.getPerspectiveTransform(ordered, np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32))
    return cv2.warpPerspective(bgr, Mw, (Wd, Hd)), conf


def _detect_checkerdice(warp):
    outs, r, pad = _run("CheckerDice_v3.tflite", warp, (640, 640))
    o = outs[0][0].T                             # [N,6]
    sc = o[:, 4:6]; cls = sc.argmax(1); s = sc.max(1); k = s >= 0.3
    b = o[k, :4].copy(); cls, s = cls[k], s[k]
    b[:, [0, 2]] *= 640; b[:, [1, 3]] *= 640
    x1 = (b[:, 0] - b[:, 2] / 2 - pad[0]) / r; y1 = (b[:, 1] - b[:, 3] / 2 - pad[1]) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - pad[0]) / r; y2 = (b[:, 1] + b[:, 3] / 2 - pad[1]) / r
    xy = np.stack([x1, y1, x2, y2], 1)
    idx = np.array(cv2.dnn.NMSBoxes([[float(a), float(bb), float(cc - a), float(dd - bb)] for a, bb, cc, dd in xy], s.tolist(), 0.3, 0.4)).flatten()
    checkers = [xy[i] for i in idx if cls[i] == 0]
    dice = [xy[i] for i in idx if cls[i] == 1]
    # BOYUT FILTRESI: gercek taslar ~tek capta; medyandan cok sapan kutu = false-positive
    # (tepsi/cerceve artigi, bolunmus kutu). Aralik genis -> iyi taslari atmaz, uc-aykiriyi eler.
    if len(checkers) >= 6:
        med = float(np.median([b[2] - b[0] for b in checkers]))
        checkers = [b for b in checkers if 0.5 * med <= (b[2] - b[0]) <= 1.7 * med]
    return checkers, dice


def _feat(warp, box):
    """Tas kutu-merkez patch'inin (S, V) medyani — renk kumeleme ozniteligi."""
    x1, y1, x2, y2 = [int(v) for v in box]; cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    rad = max(3, (x2 - x1) // 4)
    patch = warp[max(0, cy - rad):cy + rad, max(0, cx - rad):cx + rad]
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    return float(np.median(hsv[:, 1])), float(np.median(hsv[:, 2]))


def _colors(feats):
    """VERI-SURUCU renk ayrimi: taslarin (S,V)'sini 2 kumeye bol (tahtaya gore adaptif; sabit
    esik farkli taş rengi/isikta coker, or. 02.57.00 hepsini beyaz sanar). Beyaz = yuksek-V kume.
    Dejenerasyon (<2 tas / ayrismiyor) -> sabit S esigine dus."""
    n = len(feats)
    if n < 2:
        return ["W" if s < COLOR_S_THRESH else "R" for s, _ in feats]
    f = np.array(feats, np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(f, 2, None, crit, 5, cv2.KMEANS_PP_CENTERS)
    labels = labels.ravel()
    # iki kume ayrismiyor mu (ayni renk) -> sabit esige dus
    if abs(centers[0][0] - centers[1][0]) < 35 and abs(centers[0][1] - centers[1][1]) < 35:
        return ["W" if s < COLOR_S_THRESH else "R" for s, _ in feats]
    white = int(np.argmax(centers[:, 1]))  # daha parlak (yuksek V) kume = beyaz/sedef
    return ["W" if lb == white else "R" for lb in labels]


def _cluster(items):
    pts = []
    for row, grp in (("T", [i for i in items if i[1] < Hd / 2]), ("B", [i for i in items if i[1] >= Hd / 2])):
        grp.sort(key=lambda i: i[0]); cur = []
        for it in grp:
            if cur and it[0] - cur[-1][0] > GAP:
                pts.append(_mk(row, cur)); cur = []
            cur.append(it)
        if cur:
            pts.append(_mk(row, cur))
    return pts


def _mk(row, g):
    cols = [x[2] for x in g]; r = sum(c == "R" for c in cols)
    return {"row": row, "x": int(np.mean([x[0] for x in g])), "count": len(g),
            "color": "R" if r >= len(cols) - r else "W", "mixed": 0 < r < len(cols)}


def _number(row, x, barcenter, bar_half, spacing):
    if x < barcenter:
        j = max(0, min(5, int(round(((barcenter - bar_half) - x) / spacing))))
        return (18 - j) if row == "T" else (7 + j)
    j = max(0, min(5, int(round((x - (barcenter + bar_half)) / spacing))))
    return (19 + j) if row == "T" else (6 - j)


def _classify(name, warp, box, pad=0.15):
    x1, y1, x2, y2 = box; w, h = x2 - x1, y2 - y1
    cx1 = int(max(0, x1 - w * pad)); cy1 = int(max(0, y1 - h * pad))
    cx2 = int(min(warp.shape[1], x2 + w * pad)); cy2 = int(min(warp.shape[0], y2 + h * pad))
    crop = warp[cy1:cy2, cx1:cx2]
    if crop.size == 0:
        return None, 0.0
    outs, _, _ = _run(name, crop, (96, 96), stretch=True)
    out = outs[0][0]
    return int(out.argmax()), float(out.max())


def recognize(bgr, flip=False):
    with _LOCK:
        warp, board_conf = _warp(bgr)
        if warp is None:
            return {"ok": False, "error": "board_not_found", "board_conf": board_conf}
        checkers, dice = _detect_checkerdice(warp)
        cols = _colors([_feat(warp, b) for b in checkers])
        items = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, cols[i], b) for i, b in enumerate(checkers)]
        pts = _cluster(items)

        # SPACING: SATIR-ICI ardisik farklardan (ust+alt karistirmak spacing'i bozar -> clamp cakismasi).
        row_diffs = []
        for rw in ("T", "B"):
            rx = sorted(p["x"] for p in pts if p["row"] == rw)
            row_diffs += [b - a for a, b in zip(rx, rx[1:]) if 45 < b - a < 95]
        spacing = float(np.median(row_diffs)) if row_diffs else 66.0
        # BAR: merkeze yakin GERCEK bosluk (>1.4x spacing); sahte/yok ise Wd/2 (warp tahtayi ortalar).
        xs = sorted(p["x"] for p in pts)
        cand = [(b - a, (a + b) / 2) for a, b in zip(xs, xs[1:])
                if b - a > 1.4 * spacing and 0.33 * Wd < (a + b) / 2 < 0.67 * Wd]
        barcenter = max(cand)[1] if cand else Wd / 2
        bar_half = spacing

        points = [0] * 24
        for p in pts:
            n = _number(p["row"], p["x"], barcenter, bar_half, spacing)
            if flip:
                n = 25 - n
            points[n - 1] += (1 if p["color"] == WHITE_COLOR else -1) * p["count"]

        faces = []
        for b in dice:
            f, c = _classify("DieClassify_v2.tflite", warp, b)
            if f is not None and c >= 0.6:
                faces.append(f + 1)

        white = sum(v for v in points if v > 0); black = -sum(v for v in points if v < 0)
        placed = sum(abs(v) for v in points)
        mixed = sum(1 for p in pts if p["mixed"])
        # oz-denetim degismezleri (gnubg'ye coP gondermemek icin trust-boundary guard'i):
        #   board_conf>=0.5 (gercek tahta; 0.98 iyi vs 0.16/0.001 kadraj-disi), placed==checkers
        #   (hic iptal/cakisma yok), renk<=15, karisik-hane=0, tas 10..30 (bos/sahte degil)
        valid = (board_conf >= 0.5 and placed == len(checkers)
                 and 10 <= len(checkers) <= 30 and white <= 15 and black <= 15 and mixed == 0)
        return {
            "ok": True,
            "position": {"points": points, "bar": {"white": 0, "black": 0},
                         "turn": "white", "dice": faces, "cube": {"value": 1, "owner": None}},
            "debug": {
                "board_conf": round(board_conf, 3),
                "checkers": len(checkers), "placed": placed, "white": white, "black": black,
                "mixed_points": mixed, "dice_detected": len(dice), "valid": valid,
            },
        }
