"""Yönelim (açık/koyu) sınıflandırıcısı — SAF python (numpy YOK). _orient_to_photographer'ın min-pip
kararını etiketlerden öğrenir. Model = küçük orient_model.json (params.json gibi); yoksa recognize.py
min-pip'e düşer (davranış birebir). Çekirdek fonksiyonlar modelsiz → CI birim-test (test_orient_model.py).
"""
import json
import math
import os

ORIENT_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'orient_model.json')


def orient_features(points):
    """8-özellik: as_light, as_dark, margin(=as_dark-as_light), 4 bölge |taş| toplamı, total.
    as_light/as_dark recognize.py:386-387 ile aynı (doğru atamada toplam pip küçük)."""
    p = [int(points[i]) if i < len(points) else 0 for i in range(24)]
    as_light = sum(v * (i + 1) if v > 0 else -v * (24 - i) for i, v in enumerate(p))
    as_dark = sum(-v * (i + 1) if v < 0 else v * (24 - i) for i, v in enumerate(p))
    regions = [sum(abs(p[i]) for i in rng) for rng in (range(0, 6), range(6, 12), range(12, 18), range(18, 24))]
    total = sum(abs(v) for v in p)
    return [float(as_light), float(as_dark), float(as_dark - as_light), *map(float, regions), float(total)]


def orient_label(raw_points, ground_truth):
    """Doğru renk etiketi: ham points (açık=+) ve negatifini ground_truth'a compare_position ile kıyasla;
    yakın olan. Beraberlik -> 'light' (min-pip tie davranışı)."""
    from eval import compare_position
    dl = compare_position({'points': list(raw_points)}, ground_truth)['point_diff']
    dd = compare_position({'points': [-v for v in raw_points]}, ground_truth)['point_diff']
    return 'dark' if dd < dl else 'light'


def _norm(features, mean, std):
    return [(features[j] - mean[j]) / (std[j] or 1.0) for j in range(len(features))]


def train_logistic(X, y, lr=0.1, iters=500):
    """Saf-python lojistik regresyon (y: 0=light, 1=dark). Sabit init(0)+lr+iters -> deterministik.
    Özellikleri mean/std ile normalize eder (ölçekler çok farklı); std 0 -> 1.0. z clamp [-60,60]."""
    n = len(X)
    d = len(X[0])
    mean = [sum(row[j] for row in X) / n for j in range(d)]
    std = [(sum((row[j] - mean[j]) ** 2 for row in X) / n) ** 0.5 for j in range(d)]
    Xn = [_norm(row, mean, std) for row in X]
    w = [0.0] * d
    b = 0.0
    for _ in range(iters):
        gw = [0.0] * d
        gb = 0.0
        for xi, yi in zip(Xn, y):
            z = max(-60.0, min(60.0, b + sum(w[j] * xi[j] for j in range(d))))
            err = 1.0 / (1.0 + math.exp(-z)) - yi
            for j in range(d):
                gw[j] += err * xi[j]
            gb += err
        for j in range(d):
            w[j] -= lr * gw[j] / n
        b -= lr * gb / n
    return {'version': 1, 'w': w, 'b': b, 'mean': mean, 'std': std}


def predict(features, model):
    """features -> 'light'|'dark' (sigmoid>0.5 = dark). Normalize model mean/std ile (eğitimdeki gibi)."""
    xn = _norm(features, model['mean'], model['std'])
    z = max(-60.0, min(60.0, model['b'] + sum(model['w'][j] * xn[j] for j in range(len(xn)))))
    return 'dark' if 1.0 / (1.0 + math.exp(-z)) > 0.5 else 'light'


def load_orient_model(path):
    """Model dosyasını oku; yok/bozuk -> None (recognize.py min-pip'e düşer)."""
    try:
        with open(path, encoding='utf-8') as f:
            m = json.load(f)
        return m if isinstance(m, dict) and 'w' in m else None
    except (OSError, ValueError):
        return None


ORIENT_MODEL = load_orient_model(ORIENT_MODEL_PATH)
