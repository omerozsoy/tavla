# recognize.py'nin geometri sabitlerini params'tan okuduğunu kanıtlar (venv-only: import recognize ->
# ai_edge_litert gerekir; modeller YÜKLENMEZ, yalnız saf _fit_lattice çağrılır).
import recognize as R  # noqa: F401  (PARAMS'ı aynı dict olarak paylaşsın diye importlanır)
import params


def test_fit_lattice_k_follows_k_center():
    # Tek nokta: veri K'yi kısıtlamaz -> k-prior merkeze çeker (ızgara 0.9..1.40 adım 0.05).
    pts = [{'row': 'T', 'x': 700.0, 'count': 1, 'mixed': False}]
    params.apply_params(params.DEFAULT_PARAMS)          # taban (1.07)
    _, _, _, k_def, _ = R._fit_lattice(pts)
    params.apply_params({'k_center': 1.30})
    _, _, _, k_new, _ = R._fit_lattice(pts)
    params.apply_params(params.DEFAULT_PARAMS)          # diğer testleri etkileme
    assert abs(k_def - 1.05) < 1e-6   # 1.07'ye en yakın ızgara değeri
    assert abs(k_new - 1.30) < 1e-6
