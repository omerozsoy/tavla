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
