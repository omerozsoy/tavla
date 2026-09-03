"""Tavla mantik dogrulamasi. Fazla pul = kesin hata; eksik = borne-off olabilir (hata degil)."""

MAX_CHECKERS = 15


def validate(points: dict[int, tuple[str, int]], bar: dict[str, int]):
    """Return (errors: list[str], light_total, dark_total).

    Kurallar: her renk board+bar <= 15 (fazla = INVALID). Negatif olamaz.
    Eksik (toplam < 15) HATA DEGIL -> borne-off olabilir.
    """
    errors: list[str] = []
    light = sum(c for (cls, c) in points.values() if cls == "light") + bar["light"]
    dark = sum(c for (cls, c) in points.values() if cls == "dark") + bar["dark"]

    for cls, tot in (("light", light), ("dark", dark)):
        if tot > MAX_CHECKERS:
            errors.append(f"TOO_MANY_{cls.upper()}_CHECKERS")
    for p, (_, c) in points.items():
        if c < 0:
            errors.append(f"NEGATIVE_COUNT_P{p}")
    return errors, light, dark
