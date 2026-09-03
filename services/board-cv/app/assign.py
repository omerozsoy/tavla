"""Point assignment: pul tespitleri -> hane/bar sayimlari.

YOLO tek tek pul verir -> hane sayisi = o haneye dusen tespit adedi (yigin coz).
Her hane tek renk; karisik gelirse cogunluk alinir (digeri review'a).
"""
from collections import defaultdict

from .detector import Checker
from .geometry import POINT_REGIONS, in_bar


def _point_for(cx: float, cy: float) -> int | None:
    """Sutun (x) + yari (cy<0.5 ust) ile hane; y-strict degil (yuksek yigin merkezi kayar)."""
    if in_bar(cx):
        return None
    row = "top" if cy < 0.5 else "bottom"
    for r in POINT_REGIONS:
        if r.row == row and r.x0 <= cx <= r.x1:
            return r.point
    return None


def assign(checkers: list[Checker]):
    """Return (points: dict[int,(cls,count)], bar: {'light','dark'}, conf, review_points, mixed)."""
    per_point: dict[int, dict[str, int]] = defaultdict(lambda: {"light": 0, "dark": 0})
    bar = {"light": 0, "dark": 0}
    unassigned = 0

    for c in checkers:
        if in_bar(c.cx):
            bar[c.cls] += 1
            continue
        p = _point_for(c.cx, c.cy)
        if p is None:
            unassigned += 1
            continue
        per_point[p][c.cls] += 1

    points: dict[int, tuple[str, int]] = {}
    review_points: list[int] = []
    for p, d in per_point.items():
        light, dark = d["light"], d["dark"]
        if light == 0 and dark == 0:
            continue
        if light > 0 and dark > 0:
            review_points.append(p)  # ayni hanede iki renk -> supheli
        cls = "light" if light >= dark else "dark"
        points[p] = (cls, max(light, dark))

    total = max(1, len(checkers))
    conf = 1.0 - (unassigned / total) - 0.1 * len(review_points)
    conf = max(0.0, min(1.0, conf))
    return points, bar, conf, review_points
