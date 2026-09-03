"""Merkezi board geometrisi — src/ui/boardGeometry.ts'in KANONIK aynasi.

Normalize (tepeden-duz) board uzerindeki sabit bolgeler. Magic number YOK.
Numbering engine ile ayni: point 1..24 -> points[point-1], +acik(light)/-koyu(dark).
Degerler boardGeometry.ts ile BIREBIR ayni olmali (tek gercek kaynak: frontend).
"""
from dataclasses import dataclass
from typing import Literal

BOARD_NORMALIZED_WIDTH = 1120
BOARD_NORMALIZED_HEIGHT = 760

BAR_X_START = 0.47
BAR_X_END = 0.53
TRIANGLE_HEIGHT_RATIO = 0.42


@dataclass(frozen=True)
class PointRegion:
    point: int  # 1..24 (engine label; points[point-1])
    x0: float
    y0: float
    x1: float
    y1: float
    stack_dir: Literal["down", "up"]  # ust haneler asagi, alt haneler yukari istifler
    half: Literal["left", "right"]
    row: Literal["top", "bottom"]


def _columns(x0: float, x1: float) -> list[tuple[float, float]]:
    w = (x1 - x0) / 6
    return [(x0 + i * w, x0 + (i + 1) * w) for i in range(6)]


_LEFT = _columns(0.0, BAR_X_START)
_RIGHT = _columns(BAR_X_END, 1.0)
# Board.tsx gorsel dizilimi: ust 13..18 | 19..24, alt 12..7 | 6..1 (soldan saga)
_TOP_L = [13, 14, 15, 16, 17, 18]
_TOP_R = [19, 20, 21, 22, 23, 24]
_BOT_L = [12, 11, 10, 9, 8, 7]
_BOT_R = [6, 5, 4, 3, 2, 1]


def _build() -> list[PointRegion]:
    out: list[PointRegion] = []
    top = (0.0, TRIANGLE_HEIGHT_RATIO)
    bot = (1.0 - TRIANGLE_HEIGHT_RATIO, 1.0)
    for pts, cols, row, half in [
        (_TOP_L, _LEFT, "top", "left"),
        (_TOP_R, _RIGHT, "top", "right"),
        (_BOT_L, _LEFT, "bottom", "left"),
        (_BOT_R, _RIGHT, "bottom", "right"),
    ]:
        y0, y1 = top if row == "top" else bot
        for p, (cx0, cx1) in zip(pts, cols):
            out.append(PointRegion(p, cx0, y0, cx1, y1,
                                   "down" if row == "top" else "up", half, row))  # type: ignore[arg-type]
    return out


POINT_REGIONS: list[PointRegion] = _build()
BAR_REGION = {"x0": BAR_X_START, "x1": BAR_X_END, "y0": 0.0, "y1": 1.0}


def point_at(nx: float, ny: float) -> int | None:
    """Normalize (0..1) merkez -> hangi point (1..24) veya None (bar/bosluk)."""
    for r in POINT_REGIONS:
        if r.x0 <= nx <= r.x1 and r.y0 <= ny <= r.y1:
            return r.point
    return None


def in_bar(nx: float) -> bool:
    return BAR_X_START <= nx <= BAR_X_END
