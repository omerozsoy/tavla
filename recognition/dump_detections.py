"""
Faz 1 ilk adim: 5 TFLite modelini GERCEK fotografta kosup ham tespitleri gor.
Korlemesine gecmeyecegiz; once veriyi gorup YOLO cikti formatini (normalize mi,
sigmoid mi), tespit kalitesini ve board maskesini ampirik ogrenecegiz.

Kullanim:
  python recognition/dump_detections.py "<image.jpeg>"
Cikti:  .tmp/recog-out/*.png  (gorsel overlay + maske)  +  stdout tanilama
"""
import sys, os
import numpy as np
import cv2
from ai_edge_litert.interpreter import Interpreter

MODELS_DIR = "tensor-models"
OUT = ".tmp/recog-out"
os.makedirs(OUT, exist_ok=True)


def letterbox(img, new_hw):
    """Standart YOLO letterbox: en-boy koru, pad'le. (resized, scale, (padx, pady)) doner."""
    nh, nw = new_hw
    h, w = img.shape[:2]
    r = min(nh / h, nw / w)
    uw, uh = int(round(w * r)), int(round(h * r))
    resized = cv2.resize(img, (uw, uh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((nh, nw, 3), 114, dtype=np.uint8)
    px, py = (nw - uw) // 2, (nh - uh) // 2
    canvas[py:py + uh, px:px + uw] = resized
    return canvas, r, (px, py)


def run_model(name, img_bgr, in_hw):
    interp = Interpreter(model_path=os.path.join(MODELS_DIR, name))
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    outs = interp.get_output_details()
    canvas, r, (px, py) = letterbox(img_bgr, in_hw)
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = np.expand_dims(rgb, 0).astype(inp["dtype"])
    interp.set_tensor(inp["index"], x)
    interp.invoke()
    results = [interp.get_tensor(o["index"]) for o in outs]
    return results, r, (px, py), [o["shape"].tolist() for o in outs]


def decode_yolo(out, nc, in_hw, r, pad, conf=0.25):
    """out: [1, 4+nc, N] -> liste[(x1,y1,x2,y2,score,cls)] orijinal-piksel koordinatinda."""
    o = out[0]                       # [4+nc, N]
    o = o.transpose(1, 0)            # [N, 4+nc]
    boxes_raw = o[:, :4]
    scores_raw = o[:, 4:4 + nc]
    # skorlar zaten 0-1 mi yoksa logit mi? tanila:
    smin, smax = float(scores_raw.min()), float(scores_raw.max())
    looks_logit = smax > 1.2 or smin < -0.2
    scores = 1 / (1 + np.exp(-scores_raw)) if looks_logit else scores_raw
    # kutular normalize [0,1] mi yoksa piksel [0,in] mi? tanila:
    bmax = float(np.abs(boxes_raw).max())
    normalized = bmax <= 1.5
    nh, nw = in_hw
    cxcywh = boxes_raw.copy()
    if normalized:
        cxcywh[:, [0, 2]] *= nw
        cxcywh[:, [1, 3]] *= nh
    cls = scores.argmax(1)
    sc = scores.max(1)
    keep = sc >= conf
    cxcywh, sc, cls = cxcywh[keep], sc[keep], cls[keep]
    # xywh(model-input piksel) -> xyxy -> pad cikar -> scale geri (orijinal piksel)
    x1 = (cxcywh[:, 0] - cxcywh[:, 2] / 2 - pad[0]) / r
    y1 = (cxcywh[:, 1] - cxcywh[:, 3] / 2 - pad[1]) / r
    x2 = (cxcywh[:, 0] + cxcywh[:, 2] / 2 - pad[0]) / r
    y2 = (cxcywh[:, 1] + cxcywh[:, 3] / 2 - pad[1]) / r
    xyxy = np.stack([x1, y1, x2, y2], 1)
    # NMS
    idxs = cv2.dnn.NMSBoxes(
        [[float(a), float(b), float(c - a), float(d - b)] for a, b, c, d in xyxy],
        sc.tolist(), conf, 0.45)
    idxs = np.array(idxs).flatten() if len(idxs) else np.array([], int)
    dets = [(xyxy[i], float(sc[i]), int(cls[i])) for i in idxs]
    return dets, dict(score_min=smin, score_max=smax, looks_logit=looks_logit,
                      box_normalized=normalized, raw_boxes=len(o), kept=len(dets))


def draw(img, dets, color, out_name):
    vis = img.copy()
    for (x1, y1, x2, y2), s, c in dets:
        cv2.rectangle(vis, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        cv2.putText(vis, f"{c}:{s:.2f}", (int(x1), int(y1) - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    cv2.imwrite(os.path.join(OUT, out_name), vis)


def main(path):
    img = cv2.imread(path)
    H, W = img.shape[:2]
    print(f"=== {os.path.basename(path)}  {W}x{H} ===\n")

    # --- CheckerDice (piyon+zar, 2 sinif) ---
    outs, r, pad, shp = run_model("CheckerDice_v3.tflite", img, (640, 640))
    dets, diag = decode_yolo(outs[0], nc=2, in_hw=(640, 640), r=r, pad=pad, conf=0.25)
    print("CheckerDice_v3:", shp, diag)
    cls_counts = {}
    for _, _, c in dets:
        cls_counts[c] = cls_counts.get(c, 0) + 1
    print("  sinif sayilari (0/1):", cls_counts)
    draw(img, dets, (0, 255, 0), "checkerdice.png")

    # --- Board (tahta + seg maske) ---
    outs, r, pad, shp = run_model("Board_v1.tflite", img, (640, 640))
    print("\nBoard_v1 cikti boyutlari:", shp)
    bdets, bdiag = decode_yolo(outs[0], nc=1, in_hw=(640, 640), r=r, pad=pad, conf=0.25)
    print("Board_v1 det:", bdiag)
    draw(img, bdets, (255, 0, 0), "board.png")

    # --- Cube (katlama kupu) ---
    outs, r, pad, shp = run_model("Cube_v2.tflite", img, (640, 384))
    cdets, cdiag = decode_yolo(outs[0], nc=1, in_hw=(640, 384), r=r, pad=pad, conf=0.25)
    print("\nCube_v2:", shp, cdiag)
    draw(img, cdets, (0, 165, 255), "cube.png")

    print("\ncikti -> .tmp/recog-out/")


if __name__ == "__main__":
    main(sys.argv[1])
