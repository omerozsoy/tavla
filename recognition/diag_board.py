"""Board_v1 neden sifir? 37 kanalin her birinin min/max'ini bas -> sinif kanali nerede?
Ayrica stretch vs letterbox, RGB vs BGR dene. Seg proto istatistigi."""
import sys, os, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter

img = cv2.imread(sys.argv[1])
H, W = img.shape[:2]


def prep(mode):
    if mode == "letterbox":
        r = min(640 / H, 640 / W)
        uw, uh = int(W * r), int(H * r)
        rs = cv2.resize(img, (uw, uh))
        c = np.full((640, 640, 3), 114, np.uint8)
        c[(640 - uh) // 2:(640 - uh) // 2 + uh, (640 - uw) // 2:(640 - uw) // 2 + uw] = rs
        return c
    return cv2.resize(img, (640, 640))  # stretch


interp = Interpreter(model_path="tensor-models/Board_v1.tflite")
interp.allocate_tensors()
inp = interp.get_input_details()[0]
outs = interp.get_output_details()
print("input:", inp["shape"], inp["dtype"])
for o in outs:
    print("output:", o["shape"], o["index"])

for mode in ["letterbox", "stretch"]:
    for order in ["RGB", "BGR"]:
        base = prep(mode)
        im = base if order == "BGR" else cv2.cvtColor(base, cv2.COLOR_BGR2RGB)
        x = np.expand_dims(im.astype(np.float32) / 255.0, 0).astype(inp["dtype"])
        interp.set_tensor(inp["index"], x)
        interp.invoke()
        det = interp.get_tensor(outs[0]["index"])[0]  # [37, 8400]
        # her kanalin global max'i
        chmax = det.max(1)
        # en yuksek 5 kanal
        top = np.argsort(chmax)[::-1][:6]
        print(f"\n[{mode}/{order}] det{det.shape}  en yuksek kanallar:",
              [(int(c), round(float(chmax[c]), 4)) for c in top])
