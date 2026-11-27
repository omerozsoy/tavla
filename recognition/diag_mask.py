"""Board_v1 seg maskesi: ch4 argmax anchor'in 32 katsayisi @ protos -> maske.
Tahtayi temiz sariyor mu? Maske + 4 kose + warp gorsellestir."""
import sys, os, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter

img = cv2.imread(sys.argv[1])
H, W = img.shape[:2]
OUT = ".tmp/recog-out"; os.makedirs(OUT, exist_ok=True)

# stretch 640 (box'lar normalize, stretch'te geri-map basit)
im = cv2.cvtColor(cv2.resize(img, (640, 640)), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
it = Interpreter(model_path="tensor-models/Board_v1.tflite"); it.allocate_tensors()
inp = it.get_input_details()[0]
it.set_tensor(inp["index"], np.expand_dims(im, 0).astype(inp["dtype"])); it.invoke()
outs = it.get_output_details()
det = it.get_tensor(outs[0]["index"])[0]        # [37,8400]
protos = it.get_tensor(outs[1]["index"])[0]      # [160,160,32]

a = int(det[4].argmax())
cx, cy, bw, bh = det[0:4, a]
coeffs = det[5:37, a]                              # [32]
print("board box norm:", [round(float(v), 3) for v in (cx, cy, bw, bh)], "conf", float(det[4, a]))

# maske = sigmoid(protos @ coeffs)
m = protos.reshape(-1, 32) @ coeffs               # [160*160]
m = 1 / (1 + np.exp(-m))
m = m.reshape(160, 160)
mask_full = cv2.resize(m, (W, H))                 # orijinal boyuta
# box ile kirp (maske kutu disinda sizabilir)
x1 = int((cx - bw / 2) * W); y1 = int((cy - bh / 2) * H)
x2 = int((cx + bw / 2) * W); y2 = int((cy + bh / 2) * H)
box_mask = np.zeros((H, W), np.uint8)
box_mask[max(0, y1):y2, max(0, x1):x2] = 1
binm = ((mask_full > 0.5) & (box_mask > 0)).astype(np.uint8) * 255

# overlay
ov = img.copy()
ov[binm > 0] = (0.5 * ov[binm > 0] + 0.5 * np.array([0, 255, 0])).astype(np.uint8)
cv2.rectangle(ov, (x1, y1), (x2, y2), (255, 0, 0), 3)

# en buyuk kontur -> 4 kose (minAreaRect + approxPolyDP)
cnts, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
corners = None
if cnts:
    c = max(cnts, key=cv2.contourArea)
    area_frac = cv2.contourArea(c) / (W * H)
    peri = cv2.arcLength(c, True)
    for eps in [0.02, 0.03, 0.05, 0.08]:
        ap = cv2.approxPolyDP(c, eps * peri, True)
        if len(ap) == 4:
            corners = ap.reshape(4, 2); break
    rect = cv2.minAreaRect(c)
    box = cv2.boxPoints(rect).astype(int)
    cv2.drawContours(ov, [box], 0, (0, 0, 255), 3)
    print(f"mask area frac: {area_frac:.3f}  approx4: {corners is not None}  minAreaRect: {rect[1]}")
cv2.imwrite(os.path.join(OUT, "board_mask.png"), ov)

# warp (minAreaRect kutusunu dikdortgene)
if cnts:
    src = cv2.boxPoints(rect).astype(np.float32)
    # kose sirasini duzenle (tl,tr,br,bl)
    s = src.sum(1); d = np.diff(src, axis=1).ravel()
    ordered = np.array([src[np.argmin(s)], src[np.argmin(d)], src[np.argmax(s)], src[np.argmax(d)]], np.float32)
    Wd, Hd = 1000, 800
    dst = np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32)
    Mwarp = cv2.getPerspectiveTransform(ordered, dst)
    warp = cv2.warpPerspective(img, Mwarp, (Wd, Hd))
    cv2.imwrite(os.path.join(OUT, "board_warp.png"), warp)
print("cikti -> board_mask.png, board_warp.png")
