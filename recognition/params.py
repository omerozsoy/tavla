"""Kalibre edilebilir geometri parametreleri (Faz 3). recognize.py bunları okur; calibrate.py tarar.

Varsayılanlar = recognize.py'nin ESKİ sabit değerleri -> params.json YOKKEN davranış DEĞİŞMEZ.
Saf modül (numpy/model importu yok) -> CI-dostu birim-test (test_params.py).
"""
import json
import os

# Anahtar -> bugünkü (deploy öncesi) sabit değer. recognize.py bu değerleri kullanıyordu.
DEFAULT_PARAMS = {
    'gap': 40,               # _cluster: aynı hane eşiği (GAP)
    'color_s_thresh': 130,   # _colors: HSV doygunluk beyaz/kırmızı eşiği (COLOR_S_THRESH)
    'k_center': 1.07,        # _fit_lattice: bar_half/spacing priorunun merkezi
    'k_prior_w': 200.0,      # _fit_lattice: k-prior ağırlığı
    'collision_w': 4.0,      # _fit_lattice: aynı-yuva çakışma cezası katsayısı (× 35²)
    'bc_prior_w': 0.002,     # _fit_lattice: barcenter ~ orta priorunun ağırlığı
}


def load_params(path):
    """Defaults ⊕ path'teki JSON (yalnız bilinen anahtarlar). Dosya yok/bozuk -> defaults kopyası."""
    params = dict(DEFAULT_PARAMS)
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        for k in DEFAULT_PARAMS:
            if k in data:
                params[k] = data[k]
    except (OSError, ValueError):
        pass
    return params


def apply_params(d):
    """Modül PARAMS'ı yerinde güncelle (yalnız bilinen anahtarlar). recognize.py AYNI dict'i okur."""
    PARAMS.update({k: v for k, v in d.items() if k in DEFAULT_PARAMS})


PARAMS = load_params(os.path.join(os.path.dirname(__file__), 'params.json'))
