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
import cube as _cube

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


def _quad_corners(cnt):
    """Seg konturunun GERCEK 4 kosesi (perspektif/yamukluk icin). minAreaRect donuk DIKDORTGEN verir:
    acili cekimde uzak (ust) sira sikisik kalir -> hane numaralari kayar. Konveks govdeyi 4 kose
    kalana kadar sadelestir; makul degilse None (cagiran minAreaRect'e duser)."""
    hull = cv2.convexHull(cnt)
    peri = cv2.arcLength(hull, True)
    for eps in (0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.07):
        ap = cv2.approxPolyDP(hull, eps * peri, True)
        if len(ap) == 4:
            q = ap.reshape(4, 2).astype(np.float32)
            # kenarin buyuk kismini kapsamali (yanlis kose -> tahtanin bir parcasini kesmesin)
            if cv2.isContourConvex(ap) and cv2.contourArea(q) >= 0.9 * cv2.contourArea(hull):
                return q
            return None
        if len(ap) < 4:
            return None
    return None


def _order(src):
    s_ = src.sum(1); d_ = np.diff(src, 1).ravel()
    return np.array([src[np.argmin(s_)], src[np.argmin(d_)], src[np.argmax(s_)], src[np.argmax(d_)]], np.float32)


def _board_quads(bgr):
    """Board_v1 seg -> aday kose dortluleri [tl,tr,br,bl]: (gercek-4-kose [perspektif], donuk-dikdortgen).
    Gercek kose acili cekimi duzeltir ama kadrajdan tasan tahtada yanlis kose bulabilir; dikdortgen tersi.
    Hangisinin iyi oldugunu izgara uyumu belirler (recognize)."""
    H, W = bgr.shape[:2]
    outs, _, _ = _run("Board_v1.tflite", bgr, (640, 640), stretch=True)
    det, protos = outs[0][0], outs[1][0]       # [37,8400], [160,160,32]
    a = int(det[4].argmax()); conf = float(det[4, a])
    m = (1 / (1 + np.exp(-(protos.reshape(-1, 32) @ det[5:37, a])))).reshape(160, 160)
    binm = (cv2.resize(m, (W, H)) > 0.5).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return [], conf
    cnt = max(cnts, key=cv2.contourArea)
    quads = []
    poly = _quad_corners(cnt)
    if poly is not None:
        quads.append(("poly", _order(poly)))
    quads.append(("rect", _order(cv2.boxPoints(cv2.minAreaRect(cnt)).astype(np.float32))))
    return quads, conf


def _board_quad(bgr):
    """Board_v1 seg -> en guvenli tahtanin kose dortlusu [tl,tr,br,bl] (goruntu yonunde). STRETCH sart.
    (Geriye-uyum: diag script'leri. recognize() _board_quads kullanir.)"""
    H, W = bgr.shape[:2]
    outs, _, _ = _run("Board_v1.tflite", bgr, (640, 640), stretch=True)
    det, protos = outs[0][0], outs[1][0]       # [37,8400], [160,160,32]
    a = int(det[4].argmax()); conf = float(det[4, a])
    m = (1 / (1 + np.exp(-(protos.reshape(-1, 32) @ det[5:37, a])))).reshape(160, 160)
    binm = (cv2.resize(m, (W, H)) > 0.5).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None, conf
    return _order(cv2.boxPoints(cv2.minAreaRect(max(cnts, key=cv2.contourArea))).astype(np.float32)), conf


def _warp_quad(bgr, quad, rot=False):
    """quad -> Wd x Hd warp. rot=True: tahta 90 derece donuk cekilmis (bar YATAY) -> goruntunun sol
    kenari warp'in ustu olur (saat yonu). 180 derece belirsizligi ayri (flip/konvansiyon acik ucu)."""
    q = np.roll(quad, 1, axis=0) if rot else quad
    Mw = cv2.getPerspectiveTransform(q, np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32))
    return cv2.warpPerspective(bgr, Mw, (Wd, Hd))


def _warp(bgr, rot=False):
    """Geriye-uyum (diag script'leri): seg + warp tek adim."""
    quad, conf = _board_quad(bgr)
    return (None, conf) if quad is None else (_warp_quad(bgr, quad, rot), conf)


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


def _fit_lattice(pts):
    """Hane izgarasini TUM kumelere birlikte uydur: (barcenter, spacing, bar_half=k*spacing).
    Eski yontem (dolu haneler arasi en buyuk bosluk ortasi) bara bitisik haneler bossa bari kaydiriyor,
    bir yari tumuyle 1 hane kayip uc gruplar ayni haneye clamp'leniyor, zit renkler birbirini SILIYORDU
    (placed 30->26). Burada: her kume en yakin hane yuvasina; maliyet = piksel kalinti^2 + 0..5 disi
    tasma + ayni-yuva carpismasi cezasi + zayif oncel (bar ~ ortada, k ~ 1.07).
    -> (slot listesi [(row, side, j)], barcenter, spacing, k, fit_rms) ; side: 'L'/'R', j: bardan uzaklik 0..5."""
    if not pts:
        return [], Wd / 2, 66.0, 1.0, 9.0
    x = np.array([p["x"] for p in pts], np.float32)
    row = np.array([0 if p["row"] == "T" else 1 for p in pts])
    BC = np.arange(0.2 * Wd, 0.8 * Wd + 1, 2, dtype=np.float32)[:, None, None, None]
    S = np.arange(45, 121, 1, dtype=np.float32)[None, :, None, None]
    K = np.arange(0.9, 1.41, 0.05, dtype=np.float32)[None, None, :, None]
    left = x[None, None, None, :] < BC
    u = np.where(left, (BC - K * S - x) / S, (x - BC - K * S) / S)
    jc = np.clip(np.rint(u), 0, 5)
    cost = (((u - jc) * S) ** 2).sum(-1)
    # carpisma: ayni satir + ayni yari + ayni j'de iki kume = imkansiz (zit renk silinir / sayi bozulur)
    slot = row * 12 + np.where(left, 0, 6) + jc
    ss = np.sort(slot, axis=-1)
    cost = cost + (ss[..., 1:] == ss[..., :-1]).sum(-1) * 4 * 35.0 ** 2
    cost = cost + 0.002 * (BC[..., 0] - Wd / 2) ** 2 + 200 * (K[..., 0] - 1.07) ** 2
    i = np.unravel_index(int(np.argmin(cost)), cost.shape)
    bc, s, k = float(BC[i[0], 0, 0, 0]), float(S[0, i[1], 0, 0]), float(K[0, 0, i[2], 0])
    fit = float(np.sqrt(((u - jc) ** 2)[i].mean()))   # RMS kalinti (hane biriminde): warp kalitesi olcusu
    slots = []
    for p in pts:
        if p["x"] < bc:
            slots.append((p["row"], "L", int(np.clip(round((bc - k * s - p["x"]) / s), 0, 5))))
        else:
            slots.append((p["row"], "R", int(np.clip(round((p["x"] - bc - k * s) / s), 0, 5))))
    return slots, bc, s, k, fit


def _slot_number(row, side, j):
    """Standart numaralama (_number ile ayni): ust-sol 18..13, ust-sag 19..24, alt-sol 7..12, alt-sag 6..1."""
    if side == "L":
        return (18 - j) if row == "T" else (7 + j)
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


def _recognize_warp(warp, board_conf, flip):
    checkers, dice = _detect_checkerdice(warp)
    cols = _colors([_feat(warp, b) for b in checkers])
    items = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, cols[i], b) for i, b in enumerate(checkers)]
    pts = _cluster(items)
    slots, barcenter, spacing, k, fit = _fit_lattice(pts)

    points = [0] * 24
    for p, sl in zip(pts, slots):
        n = _slot_number(*sl)
        if flip:
            # flip = EVLER SOLDA (kullanici secimi): sol-sag ayna. Fotonun sol-alt kosesi ceken icin
            # hane 1. (Eski 25-n ust/alt siralari takas ediyordu = yanlis anlam; hic kullanilmamisti.)
            n = 13 - n if n <= 12 else 37 - n
        points[n - 1] += (1 if p["color"] == WHITE_COLOR else -1) * p["count"]

    white = sum(v for v in points if v > 0); black = -sum(v for v in points if v < 0)
    placed = sum(abs(v) for v in points)
    mixed = sum(1 for p in pts if p["mixed"])
    collisions = len(slots) - len(set(slots))
    # oz-denetim degismezleri (gnubg'ye coP gondermemek icin trust-boundary guard'i):
    #   board_conf>=0.5 (gercek tahta; 0.98 iyi vs 0.16/0.001 kadraj-disi), placed==checkers
    #   (hic iptal/cakisma yok), renk<=15, karisik-hane=0, tas 10..30 (bos/sahte degil)
    valid = (board_conf >= 0.5 and placed == len(checkers) and collisions == 0
             and 10 <= len(checkers) <= 30 and white <= 15 and black <= 15 and mixed == 0)
    return {
        "points": points, "dice_boxes": dice, "checker_boxes": checkers,
        "debug": {
            "board_conf": round(board_conf, 3),
            "checkers": len(checkers), "placed": placed, "white": white, "black": black,
            "mixed_points": mixed, "collisions": collisions, "dice_detected": len(dice),
            "barcenter": round(barcenter), "spacing": round(spacing, 1), "bar_k": round(k, 2),
            "fit": round(fit, 3), "valid": valid,
        },
    }


def recognize(bgr, flip=False):
    with _LOCK:
        quads, board_conf = _board_quads(bgr)
        if not quads:
            return {"ok": False, "error": "board_not_found", "board_conf": board_conf}
        # Aday warp'lar: (gercek-kose | dikdortgen) x (normal | 90 derece donuk). Gecerliler icinden
        # izgaraya EN IYI oturan (en dusuk RMS kalinti) secilir: yanlis warp hane izgarasina oturmaz.
        # Donuk deneme yalniz normal yonde hic gecerli yoksa (yatay cekim = normal yol, ek maliyet yok).
        cands = []
        for rot in (False, True):
            for kind, q in quads:
                w = _warp_quad(bgr, q, rot)
                r = _recognize_warp(w, board_conf, flip)
                r["debug"]["rotated"] = rot; r["debug"]["warp"] = kind
                cands.append((r, w, q))
            if any(c[0]["debug"]["valid"] for c in cands):
                break
        good = [c for c in cands if c[0]["debug"]["valid"]]
        res, warp, quad = min(good, key=lambda c: c[0]["debug"]["fit"]) if good else cands[0]

        faces = []
        right = left = 0
        bc = res["debug"]["barcenter"]
        for b in res["dice_boxes"]:
            f, c = _classify("DieClassify_v2.tflite", warp, b)
            if f is not None and c >= 0.6:
                faces.append(f + 1)
                if (b[0] + b[2]) / 2 >= bc:
                    right += 1
                else:
                    left += 1

        # KUP (kendi modellerimiz Cube_v2 + CubeClassify_v2): bulunursa sahip konumdan (bar'in sagi =
        # ceken katladi -> rakipte, solu = cekende, bar = ortada), deger varsayilan (sahipli 2 / orta 1)
        # -> kullanici sonuc ekraninda duzeltir.
        cb = _cube.find_cube(_get, lambda crop: _run("CubeClassify_v2.tflite", crop, (96, 96), stretch=True)[0][0][0],
                             warp, res["checker_boxes"], res["dice_boxes"], res["debug"]["barcenter"])
        if cb is None and not res["debug"]["rotated"] and len(res["checker_boxes"]):
            # tahtada kup yok -> bir oyuncunun ONUNDE (tahta disi, kabul edilmis) kup var mi?
            # tas capini orijinal foto olcegine cevir (warp genisligi Wd <-> tahtanin fotodaki genisligi)
            scale = float(quad[:, 0].max() - quad[:, 0].min()) / Wd
            med = float(np.median([b[2] - b[0] for b in res["checker_boxes"]])) * scale
            cb = _cube.find_front_cube(_get, bgr, quad, med)
        cube_pos = {"value": cb["value"], "owner": cb["owner"]} if cb else {"value": 1, "owner": None}

        points, photographer, margin = _orient_to_photographer(res["points"])
        # SIRA (kullanici kurali): zar bar'in SAGINDA -> fotografi ceken atacak; SOLUNDA -> rakip.
        # Zar yok / esit -> fotografi ceken (en olasi: kendi hamlesini soruyor).
        turn = "black" if left > right else "white"
        dbg = res["debug"]
        dbg.update({"photographer": photographer, "pip_margin": margin, "cube": cb,
                    "dice_side": "left" if left > right else ("right" if right else "none")})
        return {
            "ok": True,
            "position": {"points": points, "bar": {"white": 0, "black": 0},
                         "turn": turn, "dice": faces, "cube": cube_pos},
            "debug": dbg,
        }


def _orient_to_photographer(points):
    """gnubg konvansiyonu: POZITIF = "white" = evi hane 1-6 olan oyuncu. Numaralamamizda 1-6 fotonun
    SAG-ALTI = fotografi cekenin tarafi -> pozitif fotografi ceken OLMALI. Ham tanima ise ACIK renk
    tasi pozitif yaziyordu (koyu oynayan kullanicida gnubg RAKIBIN taslarini analiz ederdi).
    Renk -> oyuncu: taslar evine dogru ilerler; dogru atamada toplam pip KUCUK. Iki atamanin toplami
    sabit (tahtadaki her tas icin n + (25-n) = 25) -> kucuk olan secilir.
    -> (points [fotografi ceken pozitif], 'light'|'dark', pip farki [guven olcusu])"""
    as_light = sum(v * (i + 1) if v > 0 else -v * (24 - i) for i, v in enumerate(points))
    as_dark = sum(-v * (i + 1) if v < 0 else v * (24 - i) for i, v in enumerate(points))
    if as_dark < as_light:
        return [-v for v in points], "dark", as_light - as_dark
    return list(points), "light", as_dark - as_light
