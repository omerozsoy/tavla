"""Izgara kalibrasyonu teshis: warp'ta ucgen-renk maskesi (kirmizi+lacivert, keçe/tas haric)
-> sutun profili. Bar ve alan sinirlari otomatik cikmali (bar/kenarda ucgen YOK)."""
import sys, os, numpy as np, cv2
import importlib.util
spec = importlib.util.spec_from_file_location("bp", "recognition/bin_points.py")
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
OUT = ".tmp/recog-out"

img = cv2.imread(sys.argv[1])
warp = bp.warp_board(img)              # 1000x800 stretch-warp
checkers, dice = bp.detect_checkers(warp)
Wd, Hd = 1000, 800
hsv = cv2.cvtColor(warp, cv2.COLOR_BGR2HSV)
S, V = hsv[:, :, 1], hsv[:, :, 2]

# felt = acik (dusuk doygunluk, yuksek value). ucgen = felt DEGIL.
felt = (S < 60) & (V > 120)
tri = (~felt).astype(np.uint8)

# tas kutularini maskeden cikar (ucgeni occlude ediyorlar)
for box, _ in checkers + dice:
    x1, y1, x2, y2 = [int(v) for v in box]
    pad = 4
    tri[max(0, y1 - pad):y2 + pad, max(0, x1 - pad):x2 + pad] = 0

# sutun profili (x boyunca ucgen-pikseli toplami)
prof = tri.sum(0).astype(float)
prof /= prof.max() + 1e-9

# 50 bin'e indir, bas
bins = 50
step = Wd // bins
red = []
for i in range(bins):
    red.append(prof[i * step:(i + 1) * step].mean())
bar = "".join("#" if v > 0.5 else ("." if v > 0.2 else " ") for v in red)
print("sutun profili (x: 0..1000, # yuksek-ucgen, bosluk=bar/kenar):")
print("[" + bar + "]")
# dip'leri bul (merkeze yakin en dusuk = bar)
center = Wd // 2
win = prof[center - 120:center + 120]
bar_x = center - 120 + int(win.argmin())
print(f"merkez civari min (muhtemel bar) x={bar_x}  deger={prof[bar_x]:.2f}")

# gorsel: tri maskesi + warp
vis = warp.copy()
vis[tri > 0] = (0.5 * vis[tri > 0] + 0.5 * np.array([0, 255, 0])).astype(np.uint8)
cv2.line(vis, (bar_x, 0), (bar_x, Hd), (0, 0, 255), 2)
cv2.imwrite(os.path.join(OUT, "grid_tri.png"), vis)
print("-> grid_tri.png")
