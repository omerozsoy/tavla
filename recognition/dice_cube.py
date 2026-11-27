"""Faz 1 son parca: zar + kup degeri.
  zar: CheckerDice sinif-1 kutulari -> crop 96 -> DieClassify (argmax+1 = 1..6)
  kup: Cube_v2 tespiti -> crop 96 -> CubeClassify (3 sinif, anlam app-ozel -> ham raporla)
Kullanim: python recognition/dice_cube.py "<img>"
"""
import sys, os, numpy as np, cv2, importlib.util
spec = importlib.util.spec_from_file_location("bp", "recognition/bin_points.py")
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
OUT = ".tmp/recog-out"
Wd, Hd = bp.Wd, bp.Hd

_die = Interpreter_die = None


def classify(model_path, crop_bgr):
    it = __import__("ai_edge_litert.interpreter", fromlist=["Interpreter"]).Interpreter(model_path=model_path)
    it.allocate_tensors(); inp = it.get_input_details()[0]
    im = cv2.resize(crop_bgr, (96, 96)); im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    it.set_tensor(inp["index"], np.expand_dims(im, 0).astype(inp["dtype"])); it.invoke()
    out = it.get_tensor(it.get_output_details()[0]["index"])[0]
    return out


def crop(img, box, pad=0.15):
    x1, y1, x2, y2 = box; w, h = x2 - x1, y2 - y1
    x1 = int(max(0, x1 - w * pad)); y1 = int(max(0, y1 - h * pad))
    x2 = int(min(img.shape[1], x2 + w * pad)); y2 = int(min(img.shape[0], y2 + h * pad))
    return img[y1:y2, x1:x2]


def detect_cube(warp):
    it = __import__("ai_edge_litert.interpreter", fromlist=["Interpreter"]).Interpreter(model_path="tensor-models/Cube_v2.tflite")
    it.allocate_tensors(); inp = it.get_input_details()[0]
    H, W = warp.shape[:2]; inH, inW = 640, 384
    r = min(inH / H, inW / W); uw, uh = int(W * r), int(H * r); px, py = (inW - uw) // 2, (inH - uh) // 2
    c = np.full((inH, inW, 3), 114, np.uint8); c[py:py + uh, px:px + uw] = cv2.resize(warp, (uw, uh))
    it.set_tensor(inp["index"], np.expand_dims(cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0, 0).astype(inp["dtype"])); it.invoke()
    o = it.get_tensor(it.get_output_details()[0]["index"])[0].T  # [N,5]
    sc = o[:, 4]; k = sc >= 0.3
    b = o[k, :4].copy(); s = sc[k]
    if not len(b): return []
    b[:, [0, 2]] *= inW; b[:, [1, 3]] *= inH
    x1 = (b[:, 0] - b[:, 2] / 2 - px) / r; y1 = (b[:, 1] - b[:, 3] / 2 - py) / r
    x2 = (b[:, 0] + b[:, 2] / 2 - px) / r; y2 = (b[:, 1] + b[:, 3] / 2 - py) / r
    xy = np.stack([x1, y1, x2, y2], 1)
    idx = np.array(cv2.dnn.NMSBoxes([[float(a), float(bb), float(cc - a), float(dd - bb)] for a, bb, cc, dd in xy], s.tolist(), 0.3, 0.45)).flatten()
    return [(xy[i], float(s[i])) for i in idx]


def main(path):
    img = cv2.imread(path)
    warp = bp.warp_board(img)
    _, dice = bp.detect_checkers(warp)
    print(f"zar tespiti (CheckerDice sinif-1): {len(dice)}")
    faces = []
    for box, _ in dice:
        out = classify("tensor-models/DieClassify_v2.tflite", crop(warp, box))
        face = int(out.argmax()) + 1; conf = float(out.max())
        faces.append(face)
        print(f"  zar box~({int((box[0]+box[2])/2)},{int((box[1]+box[3])/2)}) -> YUZ={face} (conf {conf:.2f})  dagilim={np.round(out,2).tolist()}")

    cubes = detect_cube(warp)
    print(f"\nkup tespiti (Cube_v2): {len(cubes)}")
    for box, s in cubes:
        out = classify("tensor-models/CubeClassify_v2.tflite", crop(warp, box))
        print(f"  kup box~({int((box[0]+box[2])/2)},{int((box[1]+box[3])/2)}) det{s:.2f} -> sinif={int(out.argmax())} (3-sinif ham={np.round(out,2).tolist()})")

    print(f"\nZAR = {faces}")
    vis = warp.copy()
    for box, _ in dice:
        x1, y1, x2, y2 = [int(v) for v in box]; cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 165, 255), 2)
    for box, _ in cubes:
        x1, y1, x2, y2 = [int(v) for v in box]; cv2.rectangle(vis, (x1, y1), (x2, y2), (255, 0, 255), 2)
    cv2.imwrite(os.path.join(OUT, "dice_cube.png"), vis)
    print("-> dice_cube.png")


if __name__ == "__main__":
    main(sys.argv[1])
