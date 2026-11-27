# train_orientation.py saf yardımcısı (fold doğruluğu) — modelsiz, CI-dostu.
from train_orientation import fold_accuracy


def test_fold_accuracy_counts_correct():
    model = {'version': 1, 'w': [1.0], 'b': 0.0, 'mean': [0.0], 'std': [1.0]}  # x>0 -> dark
    samples = [([5.0], 'dark'), ([-5.0], 'light'), ([5.0], 'light')]  # 2/3 doğru
    assert abs(fold_accuracy(model, samples) - 2 / 3) < 1e-9


def test_fold_accuracy_empty_is_zero():
    model = {'version': 1, 'w': [1.0], 'b': 0.0, 'mean': [0.0], 'std': [1.0]}
    assert fold_accuracy(model, []) == 0.0
