"""Faz 1 XGID adimi: kumeleri standart tavla hane-no 1-24'e esle -> yapisal points[24].
Numaralama bara-mesafe + aralik ile (anchor=bar, dis kenar gerekmez). Standart yonelim:
  ust-sol 13..18 (L->R), ust-sag 19..24, alt-sol 12..7, alt-sag 6..1. FLIP param ile 180.
Cikti: warp'a hane-no overlay + yapisal pos JSON. Gozle dogrula (orientation/turn gnubg
round-trip ile Faz 2'de kesinlesir).
Kullanim: python recognition/to_position.py "<img>" [flip]
"""
import sys, os, json, numpy as np, cv2, importlib.util
spec = importlib.util.spec_from_file_location("bp", "recognition/bin_points.py")
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
_dc = importlib.util.spec_from_file_location("dc", "recognition/dice_cube.py")
dc = importlib.util.module_from_spec(_dc); _dc.loader.exec_module(dc)
OUT = ".tmp/recog-out"
Wd, Hd = bp.Wd, bp.Hd
FLIP = len(sys.argv) > 2 and sys.argv[2] == "flip"
WHITE_COLOR = "W"   # hangi tas-rengi beyaz oyuncu (konvansiyon; gerekirse degistir)


def number_point(row, x, barcenter, bar_half, spacing):
    """(row,x) -> tavla hane-no 1..24, bara-mesafe j=0..5 ile."""
    if x < barcenter:  # sol alan
        j = int(round(((barcenter - bar_half) - x) / spacing)); j = max(0, min(5, j))
        return (18 - j) if row == "T" else (7 + j)
    else:              # sag alan
        j = int(round((x - (barcenter + bar_half)) / spacing)); j = max(0, min(5, j))
        return (19 + j) if row == "T" else (6 - j)


def main(path):
    img = cv2.imread(path)
    warp = bp.warp_board(img)
    checkers, dice = bp.detect_checkers(warp)
    items = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, bp.checker_color(warp, b), b) for b, _ in checkers]
    pts = bp.cluster_points(items)

    # zar: CheckerDice sinif-1 -> DieClassify
    dice_faces = []
    for box, _ in dice:
        out = dc.classify("tensor-models/DieClassify_v2.tflite", dc.crop(warp, box))
        if float(out.max()) >= 0.6:   # dusuk-guven zarlari atla (belirsiz)
            dice_faces.append(int(out.argmax()) + 1)

    xs = sorted(p["x"] for p in pts)
    diffs = [b - a for a, b in zip(xs, xs[1:])]
    sp = [d for d in diffs if 45 < d < 95]
    spacing = float(np.median(sp)) if sp else 66.0
    # bar = merkeze yakin en buyuk bosluk
    gaps = [(b - a, (a + b) / 2) for a, b in zip(xs, xs[1:]) if 380 < (a + b) / 2 < 620]
    barcenter = max(gaps)[1] if gaps else Wd / 2
    bar_half = spacing

    points = [0] * 24
    bar = {"white": 0, "black": 0}
    vis = warp.copy()
    cv2.line(vis, (0, Hd // 2), (Wd, Hd // 2), (180, 180, 180), 1)
    cv2.line(vis, (int(barcenter), 0), (int(barcenter), Hd), (255, 0, 255), 1)
    rows_out = []
    for p in pts:
        n = number_point(p["row"], p["x"], barcenter, bar_half, spacing)
        if FLIP:
            n = 25 - n
        sign = 1 if p["color"] == WHITE_COLOR else -1
        points[n - 1] += sign * p["count"]
        rows_out.append((n, p["color"], p["count"], p["row"], p["x"]))
        c = (0, 0, 255) if p["color"] == "R" else (255, 255, 255)
        for box in p["boxes"]:
            x1, y1, x2, y2 = [int(v) for v in box]
            cv2.rectangle(vis, (x1, y1), (x2, y2), c, 1)
        bx = p["boxes"][0]
        cv2.putText(vis, str(n), (int(bx[0]) + 2, int((bx[1] + bx[3]) / 2)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(OUT, "numbered.png"), vis)

    pos = {"points": points, "bar": bar, "turn": "white", "dice": dice_faces, "cube": {"value": 1, "owner": None}}
    print("hane-no | renk | sayi | (row,x)")
    for n, col, cnt, row, x in sorted(rows_out):
        print(f"  {n:2}  {col}  x{cnt}   ({row},{x})")
    rtot = sum(1 for p in pts if p["color"] == "R" and False)  # noqa
    print("\npoints[24]:", points)
    print("beyaz-toplam:", sum(v for v in points if v > 0), " siyah-toplam:", -sum(v for v in points if v < 0))
    print("YAPISAL POS:", json.dumps(pos))
    print("-> numbered.png  (FLIP=%s, white=%s)" % (FLIP, WHITE_COLOR))


if __name__ == "__main__":
    main(sys.argv[1])
