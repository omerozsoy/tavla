"""Faz 1 binning: warp -> 30 tas tespit -> 24 haneye ata + renk (HSV) -> gorsel + tablo.
Izgara parametrik (BAR_FRAC), warp uzerine cizip goz-kalibrasyonu yap.
Kullanim: python recognition/bin_points.py "<img>" [BAR_FRAC]
"""
import sys, os, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter
OUT = ".tmp/recog-out"; os.makedirs(OUT, exist_ok=True)
Wd, Hd = 1000, 800
BAR_FRAC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.08   # bar genisligi / tahta-genisligi


def warp_board(img):
    H, W = img.shape[:2]
    bd = Interpreter(model_path="tensor-models/Board_v1.tflite"); bd.allocate_tensors()
    bi = bd.get_input_details()[0]
    # STRETCH (letterbox DEGIL): board maske/warp kalitesi icin kritik (letterbox->yarim tas)
    im = cv2.cvtColor(cv2.resize(img, (640, 640)), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    bd.set_tensor(bi["index"], np.expand_dims(im, 0).astype(bi["dtype"])); bd.invoke()
    det = bd.get_tensor(bd.get_output_details()[0]["index"])[0]
    protos = bd.get_tensor(bd.get_output_details()[1]["index"])[0]
    a = int(det[4].argmax())
    m = (1 / (1 + np.exp(-(protos.reshape(-1, 32) @ det[5:37, a])))).reshape(160, 160)
    binm = (cv2.resize(m, (W, H)) > 0.5).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    rect = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
    src = cv2.boxPoints(rect).astype(np.float32)
    s_ = src.sum(1); d_ = np.diff(src, 1).ravel()
    ordered = np.array([src[np.argmin(s_)], src[np.argmin(d_)], src[np.argmax(s_)], src[np.argmax(d_)]], np.float32)
    Mw = cv2.getPerspectiveTransform(ordered, np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32))
    return cv2.warpPerspective(img, Mw, (Wd, Hd))


def detect_checkers(warp):
    it = Interpreter(model_path="tensor-models/CheckerDice_v3.tflite"); it.allocate_tensors()
    inp = it.get_input_details()[0]; H, W = warp.shape[:2]
    r = min(640 / H, 640 / W); uw, uh = int(W * r), int(H * r); px, py = (640 - uw) // 2, (640 - uh) // 2
    c = np.full((640, 640, 3), 114, np.uint8); c[py:py + uh, px:px + uw] = cv2.resize(warp, (uw, uh))
    it.set_tensor(inp["index"], np.expand_dims(cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0, 0).astype(inp["dtype"])); it.invoke()
    o = it.get_tensor(it.get_output_details()[0]["index"])[0].T
    sc = o[:, 4:6]; cls = sc.argmax(1); s = sc.max(1); k = s >= 0.3
    b = o[k, :4].copy(); cls, s = cls[k], s[k]; b[:, [0, 2]] *= 640; b[:, [1, 3]] *= 640
    x1 = (b[:, 0] - b[:, 2] / 2 - px) / r; y1 = (b[:, 1] - b[:, 3] / 2 - py) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - px) / r; y2 = (b[:, 1] + b[:, 3] / 2 - py) / r
    xy = np.stack([x1, y1, x2, y2], 1)
    idx = np.array(cv2.dnn.NMSBoxes([[float(a), float(bb), float(cc - a), float(dd - bb)] for a, bb, cc, dd in xy], s.tolist(), 0.3, 0.4)).flatten()
    checkers = [(xy[i], int(cls[i])) for i in idx if cls[i] == 0]
    dice = [(xy[i], int(cls[i])) for i in idx if cls[i] == 1]
    return checkers, dice


def checker_color(warp, box):
    x1, y1, x2, y2 = [int(v) for v in box]
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    rad = max(3, (x2 - x1) // 4)
    patch = warp[max(0, cy - rad):cy + rad, max(0, cx - rad):cx + rad]
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    s_med = np.median(hsv[:, 1])
    # ampirik: beyaz/sedef S<=89, kirmizi S>=205 -> aradaki bosluk ~130 (bu sette 15/15)
    # ponytail: sabit esik; renk cok farkliysa k-means(2) ile veri-surucu bol
    return "W" if s_med < 130 else "R"


GAP = 40  # ayni satirda bu kadar yakin taslar = ayni hane (hane araligi ~66px, yigin jitter ~10px)


def cluster_points(items):
    """items: [(cx, cy, color, box)] -> [{row,x,color,count,boxes}] satir-ici x-kumeleme.
    Uniform grid bar yakininda 2 haneyi lumpluyordu; tas-x kumeleme daha sağlam."""
    pts = []
    for row, rows_items in (("T", [i for i in items if i[1] < Hd / 2]),
                            ("B", [i for i in items if i[1] >= Hd / 2])):
        rows_items.sort(key=lambda i: i[0])
        cur = []
        for it in rows_items:
            if cur and it[0] - cur[-1][0] > GAP:
                pts.append(_mk(row, cur)); cur = []
            cur.append(it)
        if cur:
            pts.append(_mk(row, cur))
    return pts


def _mk(row, group):
    xs = [g[0] for g in group]
    cols = [g[2] for g in group]
    r = sum(c == "R" for c in cols); w = len(cols) - r
    return {"row": row, "x": int(sum(xs) / len(xs)),
            "color": "R" if r >= w else "W", "mixed": r > 0 and w > 0,
            "count": len(group), "boxes": [g[3] for g in group]}


def main(path):
    img = cv2.imread(path)
    warp = warp_board(img)
    checkers, dice = detect_checkers(warp)
    items = []
    for box, _ in checkers:
        x1, y1, x2, y2 = box
        items.append(((x1 + x2) / 2, (y1 + y2) / 2, checker_color(warp, box), box))
    pts = cluster_points(items)

    vis = warp.copy()
    cv2.line(vis, (0, Hd // 2), (Wd, Hd // 2), (180, 180, 180), 1)
    for p in pts:
        c = (0, 0, 255) if p["color"] == "R" else (255, 255, 255)
        for box in p["boxes"]:
            x1, y1, x2, y2 = [int(v) for v in box]
            cv2.rectangle(vis, (x1, y1), (x2, y2), c, 2)
        lbl = f"{p['row']}{p['x']}:{p['count']}{p['color']}" + ("!" if p["mixed"] else "")
        bx = p["boxes"][0]
        cv2.putText(vis, lbl, (int(bx[0]), int(bx[1]) - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
    for box, _ in dice:
        x1, y1, x2, y2 = [int(v) for v in box]
        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 165, 255), 2)
    cv2.imwrite(os.path.join(OUT, "bin_points.png"), vis)

    tot_r = sum(p["count"] for p in pts if p["color"] == "R")
    tot_w = sum(p["count"] for p in pts if p["color"] == "W")
    mixed = sum(1 for p in pts if p["mixed"])
    print(f"tas={len(checkers)} zar/dis={len(dice)}  hane={len(pts)}  KARISIK_hane={mixed}")
    for p in sorted(pts, key=lambda p: (p["row"], p["x"])):
        print(f"  {p['row']} x={p['x']:4}: {p['count']}{p['color']}" + ("  <-KARISIK" if p["mixed"] else ""))
    print(f"  TOPLAM: R={tot_r} W={tot_w}  -> bin_points.png")


if __name__ == "__main__":
    main(sys.argv[1])
