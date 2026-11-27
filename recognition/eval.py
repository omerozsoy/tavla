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


def _pts24(pos: dict) -> list:
    p = pos.get('points') or []
    return [int(p[i]) if i < len(p) else 0 for i in range(24)]


def _swap_bar(pos: dict) -> dict:
    b = pos.get('bar') or {}
    return {'white': int(b.get('black', 0)), 'black': int(b.get('white', 0))}


def color_swap(pos: dict) -> dict:
    """Renk ters: tüm taşlar işaret değiştirir, bar sahipleri takas."""
    return {'points': [-v for v in _pts24(pos)], 'bar': _swap_bar(pos)}


def lr_mirror(pos: dict) -> dict:
    """Sol-sağ ayna (recognize.py flip haritası): nokta n -> 13-n (n<=12) / 37-n (n>12)."""
    src = _pts24(pos)
    out = [0] * 24
    for i, v in enumerate(src):
        n = i + 1
        m = (13 - n) if n <= 12 else (37 - n)
        out[m - 1] += v
    return {'points': out, 'bar': pos.get('bar') or {}}


def reverse(pos: dict) -> dict:
    """180° ters: nokta n -> 25-n (dizi ters)."""
    return {'points': list(reversed(_pts24(pos))), 'bar': pos.get('bar') or {}}


def _total(pos: dict) -> int:
    b = pos.get('bar') or {}
    return sum(abs(v) for v in _pts24(pos)) + int(b.get('white', 0)) + int(b.get('black', 0))


def classify_failure(pred: dict, truth: dict) -> str:
    """Başarısız tanımayı moda ayır (Faz 1 gerekçesi): orientation_family / point_count_off / bar_shift /
    other. Öncelik sırası; eşik: bir dönüşüm point_diff'i direkt'in yarısına (<=) indiriyorsa o moddur."""
    direct = compare_position(pred, truth)['point_diff']
    if direct == 0:
        return 'other'  # başarısızlık değil (points+bar tam)
    half = direct * 0.5
    # orientation: renk-swap / ayna / 180° yorumlarından biri hatayı belirgin azaltıyor mu
    for t in (color_swap(pred), lr_mirror(pred), reverse(pred)):
        if compare_position(t, truth)['point_diff'] <= half:
            return 'orientation_family'
    # taş toplamı tutmuyor (orientation dönüşümleri toplamı korur -> buraya düşen gerçek sayı hatası)
    if _total(pred) != _total(truth):
        return 'point_count_off'
    # bar_shift: tüm noktaları ±1 kaydırmak hatayı belirgin azaltıyor mu (bir yarı 1 hane kaymış)
    pts = _pts24(pred)
    for rolled in ([pts[-1]] + pts[:-1], pts[1:] + [pts[0]]):
        if compare_position({'points': rolled, 'bar': pred.get('bar') or {}}, truth)['point_diff'] <= half:
            return 'bar_shift'
    return 'other'


def main(dir_path: str) -> None:
    import cv2  # noqa: E402  (model/opencv yalniz calistirmada gerekir)
    import recognize as R  # noqa: E402

    jsonl = os.path.join(dir_path, 'labels.jsonl')
    if not os.path.isfile(jsonl) or os.path.getsize(jsonl) == 0:
        print("0 etiket — once: php artisan photo:export-labels")
        return

    n = exact = total_diff = 0
    fails = []
    modes = {'orientation_family': 0, 'point_count_off': 0, 'bar_shift': 0, 'other': 0}
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
            pred = R.recognize(bgr, flip=bool(row.get('flip'))).get('position') or {}
            gt = row.get('ground_truth') or {}
            cmp = compare_position(pred, gt)
            n += 1
            total_diff += cmp['point_diff']
            if cmp['exact']:
                exact += 1
            else:
                fails.append((row['file'], cmp['mismatches']))
                modes[classify_failure(pred, gt)] += 1

    if n == 0:
        print("0 gecerli gorsel")
        return
    print(f"{n} foto · {exact} TAM dogru (%{100 * exact / n:.1f}) · nokta hata ort {total_diff / n:.2f}")
    print(f"basarisizlik modu -> yonelim:{modes['orientation_family']}  sayi:{modes['point_count_off']}  "
          f"bar:{modes['bar_shift']}  diger:{modes['other']}  (Faz 1 gerekcesi: yonelim baskinsa)")
    for file, mism in fails:
        print(f"  {file}: " + "; ".join(mism[:4]) + (" ..." if len(mism) > 4 else ""))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval-data')
