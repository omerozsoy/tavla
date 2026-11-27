"""B1 teshis: numaralama cakismalari. recognize.py ic fonksiyonlariyla kumeleri + barcenter/
spacing + her kumenin hane-no'sunu bas, AYNI no'ya dusen (cakisan) kumeleri isaretle."""
import sys, importlib.util, numpy as np, cv2
spec = importlib.util.spec_from_file_location("rec", "recognition/recognize.py")
R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)

img = cv2.imread(sys.argv[1])
warp, conf = R._warp(img)
checkers, dice = R._detect_checkerdice(warp)
items = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, R._color(warp, b), b) for b in checkers]
pts = R._cluster(items)

xs = sorted(p["x"] for p in pts)
diffs = [b - a for a, b in zip(xs, xs[1:])]
sp = [d for d in diffs if 45 < d < 95]
spacing = float(np.median(sp)) if sp else 66.0
gaps = [(b - a, (a + b) / 2) for a, b in zip(xs, xs[1:]) if 380 < (a + b) / 2 < 620]
barcenter = max(gaps)[1] if gaps else R.Wd / 2
bar_half = spacing

print(f"{sys.argv[1].split('at ')[-1][:9]}  board_conf={conf:.3f} checkers={len(checkers)} dice={len(dice)}")
print(f"  barcenter={barcenter:.0f} spacing={spacing:.1f} bar_half={bar_half:.0f}")
print(f"  xs={xs}")
seen = {}
collide = 0
for p in sorted(pts, key=lambda p: (p['row'], p['x'])):
    n = R._number(p['row'], p['x'], barcenter, bar_half, spacing)
    key = n
    dup = key in seen
    if dup:
        collide += 1
    seen.setdefault(key, []).append(f"{p['row']}x{p['x']}:{p['count']}{p['color']}")
    print(f"  {p['row']} x={p['x']:4} {p['count']}{p['color']} -> hane {n}" + ("  <== CAKISMA" if dup else ""))
placed = sum(p['count'] for p in pts)
print(f"  CAKISAN kume cifti={collide}  placed-cakisma kaybi var mi: toplam-tas={len(checkers)}")
for k, v in seen.items():
    if len(v) > 1:
        print(f"    hane {k} <- {v}  (FARKLI kumeler ayni haneye)")
