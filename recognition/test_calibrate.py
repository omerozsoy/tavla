# calibrate.py saf fonksiyonları (k-fold + kabul kuralı) — modelsiz, CI-dostu.
from calibrate import kfold_split, accept_params


def test_kfold_round_robin_partitions_all():
    folds = kfold_split(list(range(10)), 5)
    assert len(folds) == 5
    assert sorted(x for f in folds for x in f) == list(range(10))  # kayıp/çift yok


def test_accept_requires_margin_and_no_regression():
    assert accept_params([0.5, 0.5], [0.56, 0.56]) is True  # +%6, hiçbir fold gerilemiyor


def test_reject_when_a_fold_regresses():
    assert accept_params([0.5, 0.5], [0.70, 0.40]) is False  # ortalama iyi ama bir fold düştü


def test_reject_when_margin_too_small():
    assert accept_params([0.5, 0.5], [0.52, 0.52]) is False  # +%2 < +%5


def test_empty_folds_do_not_crash_or_accept():
    assert accept_params([], []) is False
