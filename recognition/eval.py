"""Foto analizi ETIKET/EVAL seti skorlayici.

Admin'in duzelttigi (foto -> dogru konum) ciftlerini (php artisan photo:export-labels ile uretilen
<dir>/labels.jsonl + gorseller) mevcut tanima hattindan (recognize.py) gecirir, cikti konumu etikete
gore skorlar. Model EGITIMI DEGIL: geometri (_fit_lattice/yonelim) iyilestirmelerinin regresyonunu olcer.

Kos (sunucuda, venv + modeller hazir):  python eval.py eval-data

compare_position() SAF (cv2/model GEREKMEZ) -> test_eval.py birim-test eder; cv2/recognize importlari
main() icine ALINIR ki saf fonksiyon modelsiz ortamda da import edilebilsin.
"""
import json
import os
import sys


def compare_position(pred: dict, truth: dict) -> dict:
    """Tahta durumunu kiyasla. Birincil: points[24] + bar (okunan tahta). Ikincil: dice/turn (exact'i
    bozmaz). cube KIYASLANMAZ (model okumaz, kullanici secer). Kisa/eksik points dizisi -> 0 varsay."""
    pp = pred.get('points') or []
    tp = truth.get('points') or []
    mismatches = []
    point_diff = 0
    for i in range(24):
        a = int(pp[i]) if i < len(pp) else 0
        b = int(tp[i]) if i < len(tp) else 0
        if a != b:
            mismatches.append(f"points[{i + 1}]: pred {a}, truth {b}")
            point_diff += abs(a - b)
    pb = pred.get('bar') or {}
    tb = truth.get('bar') or {}
    for k in ('white', 'black'):
        a = int(pb.get(k, 0))
        b = int(tb.get(k, 0))
        if a != b:
            mismatches.append(f"bar.{k}: pred {a}, truth {b}")
            point_diff += abs(a - b)
    return {
        'exact': not mismatches,
        'point_diff': point_diff,
        'mismatches': mismatches,
        'dice_match': sorted(pred.get('dice') or []) == sorted(truth.get('dice') or []),
        'turn_match': (pred.get('turn') or 'white') == (truth.get('turn') or 'white'),
    }


def main(dir_path: str) -> None:
    import cv2  # noqa: E402  (model/opencv yalniz calistirmada gerekir)
    import recognize as R  # noqa: E402

    jsonl = os.path.join(dir_path, 'labels.jsonl')
    if not os.path.isfile(jsonl) or os.path.getsize(jsonl) == 0:
        print("0 etiket — once: php artisan photo:export-labels")
        return

    n = exact = total_diff = 0
    fails = []
    with open(jsonl, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            img = os.path.join(dir_path, row['file'])
            bgr = cv2.imread(img)
            if bgr is None:
                print(f"atlandi (okunamadi): {row['file']}")
                continue
            out = R.recognize(bgr, flip=bool(row.get('flip')))
            cmp = compare_position(out.get('position') or {}, row.get('ground_truth') or {})
            n += 1
            total_diff += cmp['point_diff']
            if cmp['exact']:
                exact += 1
            else:
                fails.append((row['file'], cmp['mismatches']))

    if n == 0:
        print("0 gecerli gorsel")
        return
    print(f"{n} foto · {exact} TAM dogru (%{100 * exact / n:.1f}) · nokta hata ort {total_diff / n:.2f}")
    for file, mism in fails:
        print(f"  {file}: " + "; ".join(mism[:4]) + (" ..." if len(mism) > 4 else ""))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval-data')
