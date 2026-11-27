"""Faz 3 otokalibrasyon: geometri sabitlerini (params.py) etiketli eval setine karşı k-fold ile tara,
MUHAFAZAKÂR kabul kuralını geçerse params.json yaz. Model EĞİTİMİ DEĞİL — yalnız sabit ayarı.

Kos (venv, modeller hazır):  python calibrate.py eval-data

kfold_split / accept_params SAF (modelsiz) -> test_calibrate.py; main() modellere bağımlı -> sunucuda elle.
"""
import itertools
import json
import os
import sys


def kfold_split(items, k):
    """Round-robin (deterministik): öğe i -> fold i%k. k boş fold üretmez (k<=len varsayılır)."""
    return [items[i::k] for i in range(k)]


def accept_params(baseline_fold, cand_fold):
    """Kabul ⟺ ortalama exact-match +%5 İYİ VE hiçbir fold taban çizgisinin altına düşmüyor.
    Az-veri gürültüsüne (tek fold ±%11) karşı muhafazakâr. Boş/uyumsuz -> False (kabul etme)."""
    if not baseline_fold or len(baseline_fold) != len(cand_fold):
        return False
    mean = lambda xs: sum(xs) / len(xs)
    improved = mean(cand_fold) - mean(baseline_fold) >= 0.05
    no_regress = all(c >= b for c, b in zip(cand_fold, baseline_fold))
    return improved and no_regress


# --- Aşağısı venv/model-bağımlı (test_calibrate.py'de KOŞULMAZ) ---

def _load_items(dir_path):
    import cv2
    jsonl = os.path.join(dir_path, 'labels.jsonl')
    items = []
    with open(jsonl, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            bgr = cv2.imread(os.path.join(dir_path, row['file']))
            if bgr is not None:
                items.append((bgr, bool(row.get('flip')), row.get('ground_truth') or {}))
    return items


def _score_folds(params_dict, folds):
    """Her fold için exact-match oranı (verilen param setiyle). apply_params -> pipeline -> compare."""
    import recognize as R
    import params as P
    from eval import compare_position
    P.apply_params(P.DEFAULT_PARAMS)
    P.apply_params(params_dict)
    scores = []
    for fold in folds:
        if not fold:
            scores.append(0.0)
            continue
        hits = 0
        for bgr, flip, gt in fold:
            out = R.recognize(bgr, flip=flip)
            if compare_position(out.get('position') or {}, gt)['exact']:
                hits += 1
        scores.append(hits / len(fold))
    return scores


def main(dir_path):
    import params as P
    items = _load_items(dir_path)
    if len(items) < 5:
        print(f"yetersiz etiket ({len(items)}) — kalibrasyon için en az ~5 gerekir")
        return
    k = 5
    folds = kfold_split(items, k)
    grid = [dict(zip(('k_center', 'k_prior_w', 'collision_w'), c))
            for c in itertools.product((1.0, 1.07, 1.15), (100.0, 200.0, 400.0), (2.0, 4.0, 8.0))]

    baseline = _score_folds(P.DEFAULT_PARAMS, folds)
    best, best_scores = None, None
    for combo in grid:
        sc = _score_folds({**P.DEFAULT_PARAMS, **combo}, folds)
        if best_scores is None or sum(sc) > sum(best_scores):
            best, best_scores = combo, sc

    bmean = sum(baseline) / len(baseline)
    cmean = sum(best_scores) / len(best_scores)
    print(f"taban exact %{100 * bmean:.1f} · en iyi aday %{100 * cmean:.1f} {best}")
    if accept_params(baseline, best_scores):
        out = os.path.join(dir_path, '..', 'params.json')
        json.dump({**P.DEFAULT_PARAMS, **best}, open(out, 'w', encoding='utf-8'), indent=2)
        print(f"yazıldı -> {out} (uygula: shared/recognition'a taşı + daemon restart)")
    else:
        print("kazanç yok (ortalama +%5 ve gerileme-yok şartı sağlanmadı) — params.json'a DOKUNULMADI")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval-data')
