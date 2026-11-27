"""Faz 1 yönelim eğitimi: etiketli setten (foto->doğru konum) açık/koyu sınıflandırıcısını k-fold ile
eğit, min-pip tabanını geçerse orient_model.json yaz (yoksa dokunma). Model EĞİTİMİ ama SAF-python/küçük.

Kos (venv, modeller hazır):  python train_orientation.py eval-data

fold_accuracy SAF (modelsiz) -> test_train_orientation.py; main() recognize'a bağımlı -> sunucuda elle.
"""
import json
import os
import sys

from orient_model import orient_features, orient_label, train_logistic, predict, ORIENT_MODEL_PATH


def fold_accuracy(model, samples):
    """samples: [(features, true_label)]; predict==true oranı. Boş -> 0.0."""
    if not samples:
        return 0.0
    return sum(predict(f, model) == lbl for f, lbl in samples) / len(samples)


def _load_samples(dir_path):
    """Her etiketli görseli recognize et -> debug.raw_points'ten (features, true_label, minpip_label)."""
    import cv2
    import recognize as R
    jsonl = os.path.join(dir_path, 'labels.jsonl')
    out = []
    with open(jsonl, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            bgr = cv2.imread(os.path.join(dir_path, row['file']))
            if bgr is None:
                continue
            res = R.recognize(bgr, flip=bool(row.get('flip')))
            raw = (res.get('debug') or {}).get('raw_points')
            if raw is None:
                continue
            gt = row.get('ground_truth') or {}
            minpip = R._orient_to_photographer(raw)[1]
            out.append((orient_features(raw), orient_label(raw, gt), minpip))
    return out


def main(dir_path):
    from calibrate import kfold_split, accept_params
    samples = _load_samples(dir_path)
    if len(samples) < 5:
        print(f"yetersiz etiket ({len(samples)}) — eğitim için en az ~5 gerekir")
        return
    y_of = lambda lbl: 1 if lbl == 'dark' else 0
    folds = kfold_split(samples, 5)
    base_fold, model_fold = [], []
    for i in range(5):
        test = folds[i]
        train = [s for j in range(5) if j != i for s in folds[j]]
        m = train_logistic([f for f, _, _ in train], [y_of(lbl) for _, lbl, _ in train])
        model_fold.append(fold_accuracy(m, [(f, lbl) for f, lbl, _ in test]))
        base_fold.append(sum(mp == lbl for _, lbl, mp in test) / len(test) if test else 0.0)

    bmean = sum(base_fold) / len(base_fold)
    cmean = sum(model_fold) / len(model_fold)
    print(f"min-pip tabanı %{100 * bmean:.1f} · sınıflandırıcı %{100 * cmean:.1f} (k-fold)")
    if accept_params(base_fold, model_fold):
        full = train_logistic([f for f, _, _ in samples], [y_of(lbl) for _, lbl, _ in samples])
        json.dump(full, open(ORIENT_MODEL_PATH, 'w', encoding='utf-8'), indent=2)
        print(f"yazıldı -> {ORIENT_MODEL_PATH} (uygula: shared/recognition'a taşı + daemon restart)")
    else:
        print("kazanç yok (ortalama +%5 ve gerileme-yok şartı sağlanmadı) — orient_model.json'a DOKUNULMADI")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval-data')
