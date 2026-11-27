# Yönelim sınıflandırıcısı saf çekirdeği (orient_model.py) — modelsiz, CI-dostu.
from orient_model import orient_features, orient_label, train_logistic, predict, load_orient_model


def test_features_fixed_length_deterministic():
    p = [0] * 24
    p[0] = 2
    f = orient_features(p)
    assert len(f) == 8 and f == orient_features(p)


def test_orient_label_light_when_raw_matches_gt():
    raw = [0] * 24
    raw[0] = 3  # açık=+ ham
    gt = {'points': [0] * 24}
    gt['points'][0] = 3
    assert orient_label(raw, gt) == 'light'


def test_orient_label_dark_when_negation_matches_gt():
    raw = [0] * 24
    raw[0] = 3
    gt = {'points': [0] * 24}
    gt['points'][0] = -3  # çeken koyu
    assert orient_label(raw, gt) == 'dark'


def test_orient_label_tie_returns_light():
    assert orient_label([0] * 24, {'points': [0] * 24}) == 'light'


def test_train_predict_separates_toy_data():
    X = [[0.0], [0.0], [10.0], [10.0]]
    y = [0, 0, 1, 1]
    m = train_logistic(X, y)
    assert predict([0.0], m) == 'light' and predict([10.0], m) == 'dark'


def test_degenerate_std_no_div_zero():
    X = [[5.0], [5.0]]
    y = [0, 1]  # std=0 -> 1.0'a düşsün
    m = train_logistic(X, y)
    assert predict([5.0], m) in {'light', 'dark'}


def test_load_missing_or_corrupt_returns_none(tmp_path):
    assert load_orient_model(str(tmp_path / 'yok.json')) is None
    bad = tmp_path / 'b.json'
    bad.write_text('{ not json')
    assert load_orient_model(str(bad)) is None
