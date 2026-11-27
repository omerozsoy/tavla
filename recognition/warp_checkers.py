"""board->warp->CheckerDice'i WARP'ta kos->kutular + 12-hane grid overlay.
Hane-binning fizibilitesini gosterir (Faz 1 son kanit)."""
import sys, os, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter
OUT = ".tmp/recog-out"; os.makedirs(OUT, exist_ok=True)
img = cv2.imread(sys.argv[1]); H, W = img.shape[:2]


def run(name, bgr, in_hw):
    it = Interpreter(model_path=f"tensor-models/{name}"); it.allocate_tensors()
    inp = it.get_input_details()[0]
    r = min(in_hw[0] / bgr.shape[0], in_hw[1] / bgr.shape[1])
    uw, uh = int(bgr.shape[1] * r), int(bgr.shape[0] * r)
    c = np.full((in_hw[0], in_hw[1], 3), 114, np.uint8)
    px, py = (in_hw[1] - uw) // 2, (in_hw[0] - uh) // 2
    c[py:py + uh, px:px + uw] = cv2.resize(bgr, (uw, uh))
    x = cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    it.set_tensor(inp["index"], np.expand_dims(x, 0).astype(inp["dtype"])); it.invoke()
    o = it.get_tensor(it.get_output_details()[0]["index"])[0].T  # [N,4+nc]
    return o, r, (px, py)


def dets_from(o, nc, in_hw, r, pad, conf=0.3):
    sc = o[:, 4:4 + nc]; cls = sc.argmax(1); s = sc.max(1)
    k = s >= conf; b = o[k, :4].copy(); cls, s = cls[k], s[k]
    b[:, [0, 2]] *= in_hw[1]; b[:, [1, 3]] *= in_hw[0]
    x1 = (b[:, 0] - b[:, 2] / 2 - pad[0]) / r; y1 = (b[:, 1] - b[:, 3] / 2 - pad[1]) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - pad[0]) / r; y2 = (b[:, 1] + b[:, 3] / 2 - pad[1]) / r
    xy = np.stack([x1, y1, x2, y2], 1)
    idx = cv2.dnn.NMSBoxes([[float(a), float(b_), float(c_ - a), float(d - b_)] for a, b_, c_, d in xy], s.tolist(), conf, 0.45)
    idx = np.array(idx).flatten() if len(idx) else []
    return [(xy[i], float(s[i]), int(cls[i])) for i in idx]

# 1) board maske -> warp
o, r, pad = run("Board_v1.tflite", img, (640, 640))
it = Interpreter(model_path="tensor-models/Board_v1.tflite"); it.allocate_tensors()
inp = it.get_input_details()[0]
rr = min(640 / H, 640 / W); uw, uh = int(W * rr), int(H * rr)
cc = np.full((640, 640, 3), 114, np.uint8); px, py = (640 - uw) // 2, (640 - uh) // 2
cc[py:py + uh, px:px + uw] = cv2.resize(img, (uw, uh))
it.set_tensor(inp["index"], np.expand_dims(cv2.cvtColor(cc, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0, 0).astype(inp["dtype"])); it.invoke()
det = it.get_tensor(it.get_output_details()[0]["index"])[0]
protos = it.get_tensor(it.get_output_details()[1]["index"])[0]
a = int(det[4].argmax()); coeffs = det[5:37, a]
m = (1 / (1 + np.exp(-(protos.reshape(-1, 32) @ coeffs)))).reshape(160, 160)
mask = cv2.resize(m, (W, H)) > 0.5
binm = (mask.astype(np.uint8)) * 255
cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(cnts, key=cv2.contourArea); rect = cv2.minAreaRect(c)
src = cv2.boxPoints(rect).astype(np.float32)
s_ = src.sum(1); d_ = np.diff(src, 1).ravel()
ordered = np.array([src[np.argmin(s_)], src[np.argmin(d_)], src[np.argmax(s_)], src[np.argmax(d_)]], np.float32)
Wd, Hd = 1200, 900
Mwarp = cv2.getPerspectiveTransform(ordered, np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32))
warp = cv2.warpPerspective(img, Mwarp, (Wd, Hd))

# 2) CheckerDice'i warp'ta kos
o2, r2, pad2 = run("CheckerDice_v3.tflite", warp, (640, 640))
dets = dets_from(o2, 2, (640, 640), r2, pad2, conf=0.3)
vis = warp.copy()
# 12-sutun + ust/alt grid (gorsel yardim)
for i in range(13):
    x = int(Wd * i / 12); cv2.line(vis, (x, 0), (x, Hd), (200, 200, 200), 1)
cv2.line(vis, (0, Hd // 2), (Wd, Hd // 2), (200, 200, 200), 1)
cv2.line(vis, (Wd // 2, 0), (Wd // 2, Hd), (0, 0, 0), 2)  # bar
for (x1, y1, x2, y2), sc, cl in dets:
    col = (0, 200, 0) if cl == 0 else (0, 0, 255)
    cv2.rectangle(vis, (int(x1), int(y1)), (int(x2), int(y2)), col, 2)
cv2.imwrite(os.path.join(OUT, "warp_checkers.png"), vis)
cc0 = sum(1 for _, _, c in dets if c == 0); cc1 = len(dets) - cc0
print(f"warp'ta CheckerDice: {len(dets)} tespit (sinif0={cc0}, sinif1={cc1}) -> warp_checkers.png")
