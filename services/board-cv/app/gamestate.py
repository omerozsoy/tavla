"""Tespit -> engine-uyumlu game state. KANONIK: light=beyaz(+), dark=siyah(-).

points[i] = hane i+1. off UYDURULMAZ (fotoda gorunmez; eksik != hata).
"""


def to_points_array(points: dict[int, tuple[str, int]]) -> list[int]:
    arr = [0] * 24
    for p, (cls, count) in points.items():
        if 1 <= p <= 24:
            arr[p - 1] = count if cls == "light" else -count
    return arr


def to_bar(bar: dict[str, int]) -> dict[str, int]:
    return {"white": int(bar.get("light", 0)), "black": int(bar.get("dark", 0))}


def empty_off() -> dict[str, int]:
    return {"white": 0, "black": 0}
