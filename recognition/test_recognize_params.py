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


def test_bar_checker_separated_before_fit():
    # Kullanıcı kuralı: bar şeridindeki (merkez) tas KIRIK -> fit'ten ÖNCE ayrılır, ızgarayı çarpıtmaz,
    # hiçbir haneye yerleşmez. (Bar tası fit'e girerse bc/k/sp kayar ve point-0 olarak yutulurdu.)
    params.apply_params(params.DEFAULT_PARAMS)
    # bc=500, sp=66, bar_half=1.05*66 etrafında simetrik tam ızgara -> temiz fit referansı.
    cols = [500 - 69.3 - j * 66 for j in range(5)] + [500 + 69.3 + j * 66 for j in range(5)]
    pts = [{'row': 'T', 'x': c, 'count': 2, 'mixed': False} for c in cols]
    pts += [{'row': 'B', 'x': c, 'count': 2, 'mixed': False} for c in cols]
    pts.append({'row': 'T', 'x': 500.0, 'count': 1, 'mixed': False})  # bar'da kırık tas
    bar_pts = [p for p in pts if abs(p['x'] - R.Wd / 2) < R.BAR_STRIP]
    board_pts = [p for p in pts if abs(p['x'] - R.Wd / 2) >= R.BAR_STRIP]
    assert len(bar_pts) == 1 and bar_pts[0]['x'] == 500.0        # merkez tas bar olarak ayrıldı
    _, bc, sp, k, _ = R._fit_lattice(board_pts)                  # kalan ızgara ÇARPITILMADI
    assert abs(bc - 500) < 5 and abs(sp - 66) < 3 and abs(k - 1.05) < 0.06
