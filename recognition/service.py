"""Tanima HTTP servisi (gnubg-service deseni): foto -> yapisal tavla konumu.
gnubg analizi AYRI (mevcut gnubg-service yapisal konumu alip hint doner).

GUVENLIK: yalniz 127.0.0.1 + RECOG_SECRET basligi (backend disina kapali). ASLA halka acma.
Calistirma: RECOG_PORT=8120 RECOG_SECRET=<uzun-rastgele> RECOG_MODELS_DIR=/path/tensor-models \
            python recognition/service.py
PORT NOTU: gnubg havuzu 8090-8109'u KULLANIR -> cakismamak icin 8120 varsayilan (serbest bolge).

Uclar:
  GET  /health                 -> {"ok":true}            (secret'siz)
  POST /recognize [?flip=1]     ham foto byte'lari (jpeg/png) -> recognize() JSON (secret sart)
                                flip=1: evler SOLDA (sol-sag ayna numaralama)
"""
import os, sys, json, hmac, threading
import numpy as np
import cv2
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from http.server import HTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import recognize as R   # noqa: E402

PORT = int(os.environ.get("RECOG_PORT", "8120"))  # 8090-8109 gnubg havuzu -> 8120 serbest
SECRET = os.environ.get("RECOG_SECRET", "")
MAX_BYTES = 12 * 1024 * 1024   # 12MB foto ust siniri


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth(self):
        got = self.headers.get("x-recog-secret") or ""
        return bool(SECRET) and hmac.compare_digest(got.encode(), SECRET.encode())

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            return self._send(200, {"ok": True, "service": "recognition"})
        self._send(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if not SECRET:
            return self._send(503, {"ok": False, "error": "secret_not_set"})
        if not self._auth():
            return self._send(403, {"ok": False, "error": "forbidden"})
        path = self.path.split("?")[0]
        if path != "/recognize":
            return self._send(404, {"ok": False, "error": "not_found"})
        n = int(self.headers.get("Content-Length", 0) or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._send(400, {"ok": False, "error": "bad_length"})
        raw = self.rfile.read(n)
        flip = self.path.endswith("flip=1") or "flip=1" in self.path
        try:
            bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
            if bgr is None:
                return self._send(400, {"ok": False, "error": "decode_failed"})
            result = R.recognize(bgr, flip=flip)
            self._send(200, result)
        except Exception as e:  # noqa: BLE001
            self._send(500, {"ok": False, "error": "recognize_failed", "detail": str(e)})

    def log_message(self, *a):   # sessiz
        pass


class _ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main():
    if not SECRET:
        print("UYARI: RECOG_SECRET bos -> POST /recognize 503 doner (yalniz /health calisir)", file=sys.stderr)
    # modelleri onceden yukle (ilk istek gecikmesini onle)
    try:
        R._get("Board_v1.tflite"); R._get("CheckerDice_v3.tflite"); R._get("DieClassify_v2.tflite")
    except Exception as e:  # noqa: BLE001
        print(f"model on-yukleme hatasi: {e}", file=sys.stderr)
    srv = _ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"tanima servisi 127.0.0.1:{PORT} (models={R.MODELS})", file=sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()
