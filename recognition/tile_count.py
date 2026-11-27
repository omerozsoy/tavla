"""Stack-counting hipotez-1: TILING. Warp'li tahtayi dilimlere bol, her dilimi
640'ta ayri kos (taslar buyur), global birlestir+NMS, say. Tek-karede 17 vs tiling?"""
import sys, os, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter
OUT = ".tmp/recog-out"; os.makedirs(OUT, exist_ok=True)
img = cv2.imread(sys.argv[1]); H, W = img.shape[:2]

_cd = Interpreter(model_path="tensor-models/CheckerDice_v3.tflite"); _cd.allocate_tensors()
_ci = _cd.get_input_details()[0]; _co = _cd.get_output_details()[0]


def checkerdice(bgr, conf=0.3):
    """bgr -> [(x1,y1,x2,y2,score,cls)] bgr-piksel koordinatinda (letterbox 640)."""
    h, w = bgr.shape[:2]; r = min(640 / h, 640 / w)
    uw, uh = int(w * r), int(h * r); px, py = (640 - uw) // 2, (640 - uh) // 2
    c = np.full((640, 640, 3), 114, np.uint8); c[py:py + uh, px:px + uw] = cv2.resize(bgr, (uw, uh))
    x = cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    _cd.set_tensor(_ci["index"], np.expand_dims(x, 0).astype(_ci["dtype"])); _cd.invoke()
    o = _cd.get_tensor(_co["index"])[0].T  # [N,6]
    sc = o[:, 4:6]; cls = sc.argmax(1); s = sc.max(1); k = s >= conf
    b = o[k, :4].copy(); cls, s = cls[k], s[k]
    b[:, [0, 2]] *= 640; b[:, [1, 3]] *= 640
    x1 = (b[:, 0] - b[:, 2] / 2 - px) / r; y1 = (b[:, 1] - b[:, 3] / 2 - py) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - px) / r; y2 = (b[:, 1] + b[:, 3] / 2 - py) / r
    return list(zip(x1, y1, x2, y2, s, cls))


def nms_global(dets, iou=0.4):
    if not dets: return []
    b = np.array([[d[0], d[1], d[2] - d[0], d[3] - d[1]] for d in dets], float)
    s = [float(d[4]) for d in dets]
    idx = cv2.dnn.NMSBoxes(b.tolist(), s, 0.3, iou)
    idx = np.array(idx).flatten() if len(idx) else []
    return [dets[i] for i in idx]


# --- board warp (warp_checkers.py ile ayni) ---
bd = Interpreter(model_path="tensor-models/Board_v1.tflite"); bd.allocate_tensors()
bi = bd.get_input_details()[0]
rr = min(640 / H, 640 / W); uw, uh = int(W * rr), int(H * rr)
cc = np.full((640, 640, 3), 114, np.uint8); px, py = (640 - uw) // 2, (640 - uh) // 2
cc[py:py + uh, px:px + uw] = cv2.resize(img, (uw, uh))
bd.set_tensor(bi["index"], np.expand_dims(cv2.cvtColor(cc, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0, 0).astype(bi["dtype"])); bd.invoke()
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
Wd, Hd = 1600, 1200
Mw = cv2.getPerspectiveTransform(ordered, np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32))
warp = cv2.warpPerspective(img, Mw, (Wd, Hd))

# --- A) tek kare ---
whole = nms_global(checkerdice(warp))
# --- B) 2x2 tiling (%15 overlap) ---
ov = 0.15
tiles = []
for ty in range(2):
    for tx in range(2):
        x0 = int(tx * Wd / 2 - (tx * ov) * Wd / 2); x1 = int((tx + 1) * Wd / 2 + ((1 - tx) * ov) * Wd / 2)
        y0 = int(ty * Hd / 2 - (ty * ov) * Hd / 2); y1 = int((ty + 1) * Hd / 2 + ((1 - ty) * ov) * Hd / 2)
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(Wd, x1), min(Hd, y1)
        for d in checkerdice(warp[y0:y1, x0:x1]):
            tiles.append((d[0] + x0, d[1] + y0, d[2] + x0, d[3] + y0, d[4], d[5]))
tiled = nms_global(tiles)


def draw(dets, name):
    v = warp.copy()
    for x1, y1, x2, y2, s, cl in dets:
        col = (0, 200, 0) if cl == 0 else (0, 0, 255)
        cv2.rectangle(v, (int(x1), int(y1)), (int(x2), int(y2)), col, 2)
    cv2.imwrite(os.path.join(OUT, name), v)


draw(whole, "count_whole.png"); draw(tiled, "count_tiled.png")
cw = sum(1 for d in whole if d[5] == 0); tw = sum(1 for d in tiled if d[5] == 0)
print(f"TEK KARE : {len(whole)} tespit (tas={cw}, zar/dis={len(whole)-cw})")
print(f"2x2 TILE : {len(tiled)} tespit (tas={tw}, zar/dis={len(tiled)-tw})")
print("-> count_whole.png, count_tiled.png")
