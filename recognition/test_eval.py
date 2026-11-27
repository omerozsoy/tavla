# recognition/eval.py saf karsilastirma fonksiyonu testleri (model/TFLite GEREKMEZ).
# Kos: cd recognition && python -m pytest test_eval.py -q
from eval import compare_position


def _pos(points=None, bar=None, turn='white', dice=None):
    return {'points': points or [0] * 24, 'bar': bar or {'white': 0, 'black': 0}, 'turn': turn, 'dice': dice or []}


def test_exact_match():
    r = compare_position(_pos(dice=[3, 1]), _pos(dice=[1, 3]))
    assert r['exact'] is True and r['point_diff'] == 0 and r['dice_match'] is True


def test_point_and_bar_mismatch_counts_diff():
    p = [0] * 24
    t = [0] * 24
    p[4] = -2
    t[4] = -3
    r = compare_position(_pos(points=p, bar={'white': 1, 'black': 0}), _pos(points=t))
    assert r['exact'] is False
    assert r['point_diff'] == 1 + 1  # points[5] |-2-(-3)|=1 + bar.white 1
    assert any('points[5]' in m for m in r['mismatches'])
    assert any('bar.white' in m for m in r['mismatches'])


def test_short_points_array_does_not_crash():
    r = compare_position({'points': [1, 2]}, _pos())
    assert isinstance(r['point_diff'], int)


def test_turn_mismatch_secondary():
    r = compare_position(_pos(turn='black'), _pos(turn='white'))
    assert r['turn_match'] is False and r['exact'] is True  # turn ikincil, exact'i bozmaz


# --- Faz 3 teşhis: başarısızlık-modu sınıflaması ---
from eval import classify_failure


def _p(points=None, bar=None):
    return {'points': points or [0] * 24, 'bar': bar or {'white': 0, 'black': 0}}


def test_orientation_family_detected_via_color_swap():
    p = [0] * 24
    t = [0] * 24
    p[0] = 3
    t[0] = -3  # renk ters
    assert classify_failure(_p(points=p), _p(points=t)) == 'orientation_family'


def test_point_count_off_detected():
    p = [0] * 24
    t = [0] * 24
    p[5] = 2
    t[5] = 5  # aynı işaret, sayı farklı; ayna/swap yardım etmez
    assert classify_failure(_p(points=p), _p(points=t)) == 'point_count_off'


def test_exact_or_unknown_returns_other():
    assert classify_failure(_p(), _p()) == 'other'


def test_classify_short_arrays_no_crash():
    assert classify_failure({'points': [1]}, _p()) in {'orientation_family', 'point_count_off', 'bar_shift', 'other'}
