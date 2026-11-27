# Kalibre edilebilir geometri parametre deposu (params.py) — saf, modelsiz, CI-dostu.
import json

from params import DEFAULT_PARAMS, load_params, apply_params, PARAMS


def test_missing_file_returns_defaults():
    assert load_params('yok-boyle-dosya.json') == DEFAULT_PARAMS


def test_partial_merge_keeps_other_defaults(tmp_path):
    p = tmp_path / 'params.json'
    p.write_text(json.dumps({'k_center': 1.25}))
    r = load_params(str(p))
    assert r['k_center'] == 1.25 and r['gap'] == DEFAULT_PARAMS['gap']


def test_unknown_keys_ignored(tmp_path):
    p = tmp_path / 'params.json'
    p.write_text(json.dumps({'bogus': 9, 'gap': 50}))
    r = load_params(str(p))
    assert 'bogus' not in r and r['gap'] == 50


def test_corrupt_json_returns_defaults(tmp_path):
    p = tmp_path / 'params.json'
    p.write_text('{ not json')
    assert load_params(str(p)) == DEFAULT_PARAMS


def test_apply_params_mutates_module_dict():
    apply_params({'gap': 77})
    assert PARAMS['gap'] == 77
    apply_params(DEFAULT_PARAMS)  # reset (diğer testleri etkileme)
    assert PARAMS['gap'] == DEFAULT_PARAMS['gap']
