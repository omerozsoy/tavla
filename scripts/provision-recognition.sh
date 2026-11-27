#!/usr/bin/env bash
# Parça 1 — Fotoğraftan Pozisyon Analizi: Python tanıma ortamı (sunucu).
# tavla kullanıcısı olarak çalışır: sudo -n -u tavla bash provision-recognition.sh
# Sistem Python'a DOKUNMAZ, sudo GEREKMEZ. Her şey shared/recognition altında (deploy'da silinmez).
set -euo pipefail

BASE=/home/tavla/tavlatv.com/shared/recognition
export HOME="$BASE"                      # uv/pip kendi içini burada tutsun (tavla gerçek home'una bağımlı olma)
export UV_PYTHON_INSTALL_DIR="$BASE/uv-python"
export UV_CACHE_DIR="$BASE/uv-cache"
export UV_NO_PROGRESS=1
UV="$BASE/bin/uv"

mkdir -p "$BASE/bin"

echo "== 1) uv binary =="
if [ ! -x "$UV" ]; then
  cd "$BASE/bin"
  curl -LsSf https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz -o uv.tgz
  tar xzf uv.tgz --strip-components=1
  rm -f uv.tgz
fi
"$UV" --version

echo "== 2) Python 3.12 (standalone, derleme yok) =="
"$UV" python install 3.12
"$UV" python find 3.12

echo "== 3) venv =="
"$UV" venv --python 3.12 "$BASE/venv"

echo "== 4) bağımlılıklar (stdlib http.server -> web framework YOK) =="
# ai-edge-litert = TFLite runtime (5 görüş modeli bununla koşar). Pillow aslında gereksiz
# (cv2 yeter) ama zarar yok.
"$UV" pip install --python "$BASE/venv/bin/python" ai-edge-litert opencv-python-headless numpy Pillow

echo "== 5) doğrulama: import + sürümler =="
"$BASE/venv/bin/python" - <<'PY'
import sys, cv2, numpy, PIL
from ai_edge_litert.interpreter import Interpreter
print("python :", sys.version.split()[0])
print("cv2    :", cv2.__version__)
print("numpy  :", numpy.__version__)
print("Pillow :", PIL.__version__)
print("litert : OK")
PY

echo "== 6) requirements freeze (tekrar-üretilebilirlik) =="
# uv venv pip içermez (uv kendi yönetir) -> freeze'i uv ile al, python -m pip DEĞİL.
"$UV" pip freeze --python "$BASE/venv/bin/python" > "$BASE/requirements.lock"
echo "lock -> $BASE/requirements.lock"

echo "== YOLLAR =="
echo "venv python : $BASE/venv/bin/python"
echo "uv binary   : $UV"
echo "PROVISION OK"
