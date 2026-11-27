"""Katlama kupu: tespit (Cube_v2) + DEGER (CubeClassify_v2) + KONUMDAN sahip.

CubeClassify_v2 kupun UST YUZUNDEKI SAYIYI okur (3 sinif). Kontrollu deneyle kanitlandi: AYNI gercek
kup kirpintisinda rakam silinip yerine sentetik sayilar yazildi (2 yazi tipi):
  "2" -> sinif 0 · "4" -> sinif 1 · "8","16","32","64" -> sinif 2 · rakamsiz -> kararsiz (.31/.24/.45)
Donme-degismez (gercek kup 0/90/180/270 ayni sinif); gercek "16" kupu sinif 2. Model YALNIZ kup
kirpintisi icin egitilmis: tas/mentese kirpintilarina verdigi sinif ANLAMSIZ (bu yuzden konum/boyut/
cakisma/renk suzgecleri ayrica sart).
Sinif 2 ("8 veya ustu") icinde 8 / 16 / 32 / 64 ayrimi modelde YOK: hane sayaci 2 derse 16, yoksa 8
varsayilir ve value_src='model_ge8' ile kullaniciya "tam degeri kontrol et" uyarisi gosterilir.
Bar uzerindeki tespit YOK SAYILIR (ortadaki kup = varsayilan; menteseler orada kup sanilabiliyor).
Siyah skor kartlari (koyu + renksiz govde) elenir.

SAHIP (kullanici kurali, zar kuraliyla ayni eksen): kup bar'in SAGINDA -> fotografi ceken KATLADI,
rakip aldi -> RAKIPTE ("black"); SOLUNDA -> cekene katlandi -> CEKENDE ("white"); bar uzeri -> ORTADA.
Tahta DISINDA bir oyuncunun ONUNDE (kabul edilmis) kup: alt -> cekende, ust -> rakipte.
"""
import numpy as np
import cv2

CUBE_DET_MIN = 0.25  # saha: uzak/kucuk kirmizi kup 0.25'te bulunuyor (eskiden 0.4 -> kaciyordu)
CUBE_CLS_MIN = 0.85  # 4-yon TTA'nin en emin yonu bu kadar emin olmali (bulanik/yanlis kirpinti elenir)
SIZE_MAX = 1.35  # kup kenari / tas capi ust sinir (saha: buyuk kup 1.15x -> 1.1 siniri kaciriyordu)
BAR_BAND = 0.06  # bar merkezine bu kadar (warp genisligi orani) yakin kup = bar uzerinde = ortada
FRONT_DET_MIN = 0.6


def detect(get_model, img):
    """Cube_v2 (girdi 640x384, letterbox) -> [(box[x1,y1,x2,y2], skor)] img koordinatinda."""
    it = get_model("Cube_v2.tflite"); inp = it.get_input_details()[0]
    H, W = img.shape[:2]; inH, inW = 640, 384
    r = min(inH / H, inW / W); uw, uh = int(W * r), int(H * r); px, py = (inW - uw) // 2, (inH - uh) // 2
    c = np.full((inH, inW, 3), 114, np.uint8); c[py:py + uh, px:px + uw] = cv2.resize(img, (uw, uh))
    it.set_tensor(inp["index"], np.expand_dims(cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0, 0)
                  .astype(inp["dtype"]))
    it.invoke()
    o = it.get_tensor(it.get_output_details()[0]["index"])[0].T
    sc = o[:, 4]; k = sc >= CUBE_DET_MIN
    b = o[k, :4].copy(); s = sc[k]
    if not len(b):
        return []
    b[:, [0, 2]] *= inW; b[:, [1, 3]] *= inH
    x1 = (b[:, 0] - b[:, 2] / 2 - px) / r; y1 = (b[:, 1] - b[:, 3] / 2 - py) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - px) / r; y2 = (b[:, 1] + b[:, 3] / 2 - py) / r
    xy = np.stack([x1, y1, x2, y2], 1)
    idx = np.array(cv2.dnn.NMSBoxes([[float(a), float(bb), float(cc - a), float(dd - bb)] for a, bb, cc, dd in xy],
                                    s.tolist(), CUBE_DET_MIN, 0.45)).flatten()
    return [(xy[i], float(s[i])) for i in idx]


def _iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u > 0 else 0.0


def is_gold(crop):
    """Mentese: doygun altin/sari (H~12-38, S/V yuksek). Kup govdesi beyaz/fildisi ya da baska renk."""
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    gold = (hsv[:, 0] >= 12) & (hsv[:, 0] <= 38) & (hsv[:, 1] >= 90) & (hsv[:, 2] >= 110)
    return gold.mean() > 0.35


def is_dark_neutral(crop):
    """Siyah skor karti ("Match to 9", flip kartlar; skor tabelasi HEP tahta disinda ama tahtanin bir
    yarisi kadraj disindaysa warp'a sizabiliyor): KOYU + RENKSIZ piksel orani. Canli olcum: skor karti
    %46, gercek kupler (beyaz/fildisi/mavi) <= %3 -> esik %25. Siyah kupler de elenir (nadir; elle secilir)."""
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    return float(((hsv[:, 2] < 70) & (hsv[:, 1] < 80)).mean()) > 0.25


def digit_count(crop):
    """Kup ust yuzundeki rakam sayisi (1 / 2 / None) — yalniz sinif-2 ("8+") icinde 8 vs 16/32/64 ipucu.
    Ince vurus cikarimi (black-hat + top-hat, iki kutup); merkeze yakin en buyuk bilesen capa, benzer boyda
    yakin komsu varsa 2. Gercek "16" kupunda dogru; kucuk/bulanik iki haneli rakamlar birlesip 1 sayilabilir
    -> sonuc her zaman 'kontrol et' uyarisiyla gosterilir."""
    if crop is None or crop.size == 0:
        return None
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY); s = 160.0 / max(g.shape)
    g = cv2.GaussianBlur(cv2.resize(g, (max(8, int(g.shape[1] * s)), max(8, int(g.shape[0] * s))),
                                    interpolation=cv2.INTER_CUBIC), (3, 3), 0)
    H, W = g.shape; k = max(9, int(0.2 * min(H, W)) | 1)
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)); best = None
    for op in (cv2.MORPH_BLACKHAT, cv2.MORPH_TOPHAT):
        f = cv2.morphologyEx(g, op, ker)
        if f.max() < 25:
            continue
        _, th = cv2.threshold(f, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        n, _, st, cen = cv2.connectedComponentsWithStats(th, 8)
        comps = []
        for i in range(1, n):
            x, y, w, h, a = st[i]
            if a < 0.006 * H * W or a > 0.2 * H * W or x <= 1 or y <= 1 or x + w >= W - 1 or y + h >= H - 1:
                continue
            if max(w, h) > 0.62 * min(H, W):
                continue
            comps.append((a, cen[i], max(w, h)))
        central = [c for c in comps if abs(c[1][0] - W / 2) < 0.3 * W and abs(c[1][1] - H / 2) < 0.3 * H]
        if not central:
            continue
        anc = max(central, key=lambda c: c[0])
        mates = [c for c in comps if c is not anc and 0.6 <= c[2] / anc[2] <= 1.6
                 and np.hypot(*(c[1] - anc[1])) <= 1.2 * anc[2]]
        cnt = 1 + min(1, len(mates))
        if best is None or anc[0] > best[1]:
            best = (cnt, anc[0])
    return best[0] if best else None


def classify_tta(run_cls, crop):
    """CubeClassify'i kirpintinin 0/90/180/270 donmus halleriyle calistir, EN EMIN yonun ciktisini don.
    Saha: rakam TERS (180) ya da yan duran kupte tek yonde guven 0.6-0.83'e dusup esigi geciyordu
    (ters "16" kup hic bulunamiyordu); okunabildigi yonde 0.88-0.98."""
    best = None
    for rc in (None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE):
        out = run_cls(np.ascontiguousarray(crop if rc is None else cv2.rotate(crop, rc)))
        if best is None or float(out.max()) > float(best.max()):
            best = out
    return best


def _value(cls, hi_crop, centered):
    """CubeClassify cikisi -> (deger, value_src). centered: kup bar uzerinde (oyun basi kupu)."""
    c = int(cls.argmax())
    if centered:
        return 1, "centered"
    if c == 0:
        return 2, "model"
    if c == 1:
        return 4, "model"
    # sinif 2 = 8 veya ustu: hane sayisi ipucu (2 hane -> 16; aksi 8). Kullanici uyarilir.
    return (16 if digit_count(hi_crop) == 2 else 8), "model_ge8"


def _hi_crop(img, x1, y1, x2, y2, pad=0.25):
    pw, ph = pad * (x2 - x1), pad * (y2 - y1)
    return img[max(0, int(y1 - ph)):int(y2 + ph), max(0, int(x1 - pw)):int(x2 + pw)]


def find_cube(get_model, run_cls, warp, checker_boxes, die_boxes, barcenter, img=None, minv=None):
    """Warp'ta kupu bul + oku -> {'box','det','cls','zone','owner','value','value_src'} | None.
    Dogrulama: Cube_v2 >= 0.25 + CubeClassify (4-yon TTA) bir degerden >= 0.85 emin + altin/skor-karti
    degil + tas/zar kutusuyla cakismaz + kenar uzunlugu tas capinin 0.4-1.35 kati. Coklu aday -> en yuksek tespit.
    img/minv verilirse hane sayaci icin ORIJINAL fotodan (daha yuksek cozunurluk) kirpilir."""
    med = float(np.median([b[2] - b[0] for b in checker_boxes])) if len(checker_boxes) else 60.0
    best = None
    for box, s in detect(get_model, warp):
        x1, y1, x2, y2 = [int(v) for v in box]
        cw = warp[max(0, y1):y2, max(0, x1):x2]
        if cw.size == 0:
            continue
        side = max(x2 - x1, y2 - y1)
        if not (0.4 * med <= side <= SIZE_MAX * med):
            continue
        if any(_iou(box, b) > 0.25 for b in list(checker_boxes) + list(die_boxes)):
            continue
        if is_gold(cw) or is_dark_neutral(cw):
            continue
        cls = classify_tta(run_cls, cw)
        if float(cls.max()) < CUBE_CLS_MIN:
            continue
        if best is not None and s <= best["det"]:
            continue
        cx = (box[0] + box[2]) / 2
        if abs(cx - barcenter) < BAR_BAND * warp.shape[1]:
            # bar uzeri = ortadaki kup = zaten varsayilan (deger 1, sahipsiz). Bar'daki menteseler de
            # burada kup sanilabildigi icin (canli: soluk altin mentese) tespit YOK SAYILIR.
            continue
        zone = "right" if cx > barcenter else "left"
        # sag: ceken katladi -> rakip aldi (black); sol: cekene katlandi -> ceken aldi (white)
        owner = {"right": "black", "left": "white"}.get(zone)
        hi = cw
        if img is not None and minv is not None:
            pts = np.array([[[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]], np.float32)
            op = cv2.perspectiveTransform(pts, minv)[0]
            (ox1, oy1), (ox2, oy2) = op.min(0), op.max(0)
            hi = _hi_crop(img, ox1, oy1, ox2, oy2)
        value, src = _value(cls, hi, owner is None)
        best = {"box": [round(float(v)) for v in box], "det": round(s, 2),
                "cls": [round(float(v), 2) for v in cls], "zone": zone,
                "owner": owner if value > 1 else None, "value": value, "value_src": src}
    return best


def find_front_cube(get_model, run_cls, img, quad, checker_px):
    """Tahtanin DISINDA, bir oyuncunun ONUNDE duran (kabul edilmis) kup: orijinal fotoda tahtanin hemen
    ALTINDA -> fotografi cekenin onunde -> cekende ("white"); hemen USTUNDE -> rakibin onunde -> rakipte.
    Konum + boyut + tespit esigi: yatayda tahta araliginda, dikeyde tahta kenarina en fazla 2.5 kup boyu
    uzakta, kenar uzunlugu tas capinin 0.4-1.3 kati, altin degil. Deger CubeClassify ile okunur.
    quad: tahtanin orijinal fotodaki koseleri [tl,tr,br,bl]; checker_px: orijinal fotoda tas capi."""
    xs, ys = quad[:, 0], quad[:, 1]
    bx0, bx1, by0, by1 = float(xs.min()), float(xs.max()), float(ys.min()), float(ys.max())
    best = None
    for box, s in detect(get_model, img):
        if s < FRONT_DET_MIN:
            continue
        x1, y1, x2, y2 = [float(v) for v in box]
        cx, side = (x1 + x2) / 2, max(x2 - x1, y2 - y1)
        if not (bx0 <= cx <= bx1) or not (0.4 * checker_px <= side <= 1.3 * checker_px):
            continue
        if y2 <= by0 + 0.25 * side and by0 - y2 < 2.5 * side:
            zone, owner = "front_opp", "black"
        elif y1 >= by1 - 0.25 * side and y1 - by1 < 2.5 * side:
            zone, owner = "front_me", "white"
        else:
            continue
        crop = img[max(0, int(y1)):int(y2), max(0, int(x1)):int(x2)]
        if crop.size == 0 or is_gold(crop) or is_dark_neutral(crop):
            continue
        cls = classify_tta(run_cls, crop)
        if float(cls.max()) < CUBE_CLS_MIN:
            continue
        if best is None or s > best["det"]:
            value, src = _value(cls, _hi_crop(img, x1, y1, x2, y2), False)
            best = {"box": [round(x1), round(y1), round(x2), round(y2)], "det": round(s, 2),
                    "cls": [round(float(v), 2) for v in cls], "zone": zone, "owner": owner,
                    "value": value, "value_src": src}
    return best
