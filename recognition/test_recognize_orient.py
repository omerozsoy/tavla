# recognize.py model-opsiyonel yönelim kancası (venv-only: import recognize -> ai_edge_litert).
import recognize as R
import orient_model as OM


def test_no_model_matches_min_pip():
    raw = [0] * 24
    raw[0] = 2
    raw[23] = -2
    OM.ORIENT_MODEL = None
    assert R._orient(list(raw)) == R._orient_to_photographer(list(raw))


def test_fake_model_overrides_decision():
    raw = [0] * 24
    raw[0] = 2  # min-pip bunu 'light' derdi
    # her zaman 'dark' diyen sahte model (bias büyük) -> points negatiflenir
    OM.ORIENT_MODEL = {'version': 1, 'w': [0.0] * 8, 'b': 50.0, 'mean': [0.0] * 8, 'std': [1.0] * 8}
    pts, label, _ = R._orient(list(raw))
    assert label == 'dark' and pts[0] == -2
    OM.ORIENT_MODEL = None
