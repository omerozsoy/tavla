"""CV disi cekirdek testleri: geometri, assignment, kural, gamestate donusumu."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.assign import assign, _point_for  # noqa: E402
from app.detector import Checker  # noqa: E402
from app.gamestate import to_bar, to_points_array  # noqa: E402
from app.geometry import POINT_REGIONS  # noqa: E402
from app.rules import validate  # noqa: E402


def test_geometry_has_24_unique_points():
    pts = sorted(r.point for r in POINT_REGIONS)
    assert pts == list(range(1, 25))


def test_point_for_quadrants():
    # ust-sol ilk sutun -> 13; ust-sag son sutun -> 24; alt-sol ilk -> 12; alt-sag son -> 1
    assert _point_for(0.02, 0.05) == 13
    assert _point_for(0.99, 0.05) == 24
    assert _point_for(0.02, 0.95) == 12
    assert _point_for(0.99, 0.95) == 1
    assert _point_for(0.50, 0.5) is None  # bar


def test_assign_counts_stack():
    # Ayni haneye (13) 3 acik pul -> P13 light x3
    ch = [Checker("light", 0.9, 0.02, 0.05 + i * 0.02, 0.05, 0.08) for i in range(3)]
    points, bar, conf, review = assign(ch)
    assert points[13] == ("light", 3)
    assert not review


def test_gamestate_mapping_signs():
    points = {13: ("light", 3), 1: ("dark", 2)}
    arr = to_points_array(points)
    assert arr[12] == 3   # hane 13 = +3 (acik)
    assert arr[0] == -2   # hane 1  = -2 (koyu)
    assert len(arr) == 24


def test_rules_too_many_is_error_missing_is_ok():
    # 16 acik -> hata
    over = {i: ("light", 8) for i in (1, 2)}
    errors, light, dark = validate(over, {"light": 0, "dark": 0})
    assert "TOO_MANY_LIGHT_CHECKERS" in errors
    # 11 acik (borne-off olabilir) -> hata YOK
    few = {1: ("light", 5), 2: ("light", 6)}
    errors2, _, _ = validate(few, {"light": 0, "dark": 0})
    assert errors2 == []


def test_bar_mapping():
    assert to_bar({"light": 2, "dark": 1}) == {"white": 2, "black": 1}
