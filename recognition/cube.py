"""Katlama kupu: tespit (Cube_v2) + dogrulama (CubeClassify_v2 + piksel suzgecleri) + KONUMDAN sahip.

CubeClassify_v2 3 sinifi (canli fotolardan gozle cikarildi): 0 = kup, 1 = tas, 2 = diger (mentese,
skor karti, zar). Kup DEGERINI okuyan model YOK; kural-tabanli rakam okuyucu denendi, gercek kuplerde
2/6 isabet + kup-disi nesnelere deger atiyordu -> KULLANILMIYOR (yanlis deger gnubg kararini sessizce
bozar). Deger konumdan varsayilir, kullanici sonuc ekraninda duzeltir.
SAHIP (kullanici kurali, zar kuraliyla ayni eksen): kup bar'in SAGINDA -> fotografi ceken KATLADI,
rakip aldi -> kup RAKIPTE ("black"); SOLUNDA -> cekene katlandi, o aldi -> kup CEKENDE ("white");
bar uzerinde -> henuz katlanmamis, ORTADA (deger 1). Sahipli kup en az 2; varsayilan 2 (en sik).
"""
import numpy as np
import cv2

CUBE_DET_MIN = 0.4
CUBE_CLS_MIN = 0.9
BAR_BAND = 0.06  # bar merkezine bu kadar (warp genisligi orani) yakin kup = bar uzerinde = ortada


def detect(get_model, warp):
    """Cube_v2 (girdi 640x384, letterbox) -> [(box[x1,y1,x2,y2], skor)] warp koordinatinda."""
    it = get_model("Cube_v2.tflite"); inp = it.get_input_details()[0]
    H, W = warp.shape[:2]; inH, inW = 640, 384
    r = min(inH / H, inW / W); uw, uh = int(W * r), int(H * r); px, py = (inW - uw) // 2, (inH - uh) // 2
    c = np.full((inH, inW, 3), 114, np.uint8); c[py:py + uh, px:px + uw] = cv2.resize(warp, (uw, uh))
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


def find_cube(get_model, run_cls, warp, checker_boxes, die_boxes, barcenter):
    """Warp'ta kupu bul + dogrula -> {'box','det','cls','zone','owner','value'} | None.
    Dogrulama: Cube_v2 >= 0.4 + CubeClassify sinif-0 >= 0.9 + altin degil (mentese) + tas/zar kutusuyla
    cakismaz + kenar uzunlugu tas capinin 0.4-1.1 kati. Birden cok aday -> en yuksek tespit skoru."""
    med = float(np.median([b[2] - b[0] for b in checker_boxes])) if len(checker_boxes) else 60.0
    best = None
    for box, s in detect(get_model, warp):
        x1, y1, x2, y2 = [int(v) for v in box]
        cw = warp[max(0, y1):y2, max(0, x1):x2]
        if cw.size == 0:
            continue
        side = max(x2 - x1, y2 - y1)
        if not (0.4 * med <= side <= 1.1 * med):
            continue
        if any(_iou(box, b) > 0.25 for b in list(checker_boxes) + list(die_boxes)):
            continue
        cls = run_cls(np.ascontiguousarray(cw))
        if int(cls.argmax()) != 0 or float(cls[0]) < CUBE_CLS_MIN:
            continue
        if is_gold(cw):
            continue
        if best is None or s > best["det"]:
            cx = (box[0] + box[2]) / 2
            zone = "bar" if abs(cx - barcenter) < BAR_BAND * warp.shape[1] else ("right" if cx > barcenter else "left")
            # sag: ceken katladi -> rakip aldi (black); sol: cekene katlandi -> ceken aldi (white)
            owner = {"right": "black", "left": "white"}.get(zone)
            best = {"box": [round(float(v)) for v in box], "det": round(s, 2), "cls": round(float(cls[0]), 2),
                    "zone": zone, "owner": owner, "value": 2 if owner else 1}
    return best


FRONT_DET_MIN = 0.6


def find_front_cube(get_model, img, quad, checker_px):
    """Tahtanin DISINDA, bir oyuncunun ONUNDE duran (kabul edilmis) kup: orijinal fotoda tahtanin hemen
    ALTINDA -> fotografi cekenin onunde -> cekende ("white"); hemen USTUNDE -> rakibin onunde -> rakipte.
    Tahta disi oldugu icin CubeClassify KULLANILMAZ (canli: mavi/beyaz rakamli kupu 'diger' sanıyordu);
    yerine siki konum + boyut + tespit esigi: yatayda tahta araliginda, dikeyde tahta kenarina en fazla
    2.5 kup boyu uzakta, kenar uzunlugu tas capinin 0.4-1.3 kati, altin degil.
    quad: tahtanin orijinal fotodaki koseleri [tl,tr,br,bl]; checker_px: orijinal fotoda tas capi."""
    xs, ys = quad[:, 0], quad[:, 1]
    bx0, bx1, by0, by1 = float(xs.min()), float(xs.max()), float(ys.min()), float(ys.max())
    best = None
    for box, s in detect(get_model, img):
        if s < FRONT_DET_MIN:
            continue
        x1, y1, x2, y2 = [float(v) for v in box]
        cx, cy, side = (x1 + x2) / 2, (y1 + y2) / 2, max(x2 - x1, y2 - y1)
        if not (bx0 <= cx <= bx1) or not (0.4 * checker_px <= side <= 1.3 * checker_px):
            continue
        if y2 <= by0 + 0.25 * side and by0 - y2 < 2.5 * side:
            zone, owner = "front_opp", "black"
        elif y1 >= by1 - 0.25 * side and y1 - by1 < 2.5 * side:
            zone, owner = "front_me", "white"
        else:
            continue
        crop = img[max(0, int(y1)):int(y2), max(0, int(x1)):int(x2)]
        if crop.size == 0 or is_gold(crop):
            continue
        if best is None or s > best["det"]:
            best = {"box": [round(x1), round(y1), round(x2), round(y2)], "det": round(s, 2), "cls": None,
                    "zone": zone, "owner": owner, "value": 2}
    return best
