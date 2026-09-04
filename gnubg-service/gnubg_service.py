# GNU Backgammon analiz servisi — gnubg'yi AÇIK tutar, HTTP ile analiz sunar (validator gibi).
#
# Neden: gnubg ağır bir C programı; her istekte yeniden başlatmak pahalı. Bu betik gnubg'nin
# GÖMÜLÜ Python'unda çalışır (`gnubg -t -q -p gnubg_service.py`), gnubg bir kez yüklenir ve
# açık kalır; HTTP istekleri geldikçe gnubg.setgnubgid()+hint()/evaluate() çağırır, JSON döner.
#
# TEK-THREAD: gnubg'nin geçerli konumu GLOBAL durumdur (setgnubgid onu değiştirir). Bu yüzden
# istekleri SIRAYLA işleriz (HTTPServer tek-thread) -> yarış yok. Yük düşük (post-maç analiz).
#
# GÜVENLİK: yalnız 127.0.0.1'e bağlan + GNUBG_SECRET başlığı (backend dışına kapalı). ASLA halka
# açık portta çalıştırma (validator gibi iç servis).
#
# Çalıştırma: GNUBG_PORT=8092 GNUBG_SECRET=<uzun-rastgele> gnubg -t -q -p gnubg_service.py
# (Plesk/AlmaLinux'ta systemd ile kalıcı — bkz README.md.)

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import gnubg  # gnubg'nin gömülü Python modülü (yalnız `gnubg -p` içinde vardır)
except ImportError:  # düz python ile çalıştırılırsa anlamlı hata
    raise SystemExit("Bu betik gnubg gömülü Python'unda çalışmalı: gnubg -t -q -p gnubg_service.py")

PORT = int(os.environ.get("GNUBG_PORT", "8092"))
SECRET = os.environ.get("GNUBG_SECRET", "")

# Değerlendirme bağlamı (ply). İstek 'plies' verirse setevalhintfilter ile geçici ayarlanır.
# Varsayılan gnubg ayarı korunur; ileride Fast/Deep/TavlaiDeep için buradan sürülür.


def _hint_for(gnubgid, plies=None):
    """Verilen gnubgid (posID:matchID) için gnubg.hint() sonucunu döndür (yapısal dict)."""
    gnubg.setgnubgid(gnubgid)  # konumu + maç bağlamını (küp/skor/sıra/zar) BİREBİR kur
    if plies is not None:
        # 0-ply/2-ply gibi derinliği ayarla (Fast/Deep). Hata olursa varsayılanı kullan.
        try:
            gnubg.command("set evaluation chequer evaluation plies %d" % int(plies))
        except Exception:
            pass
    return gnubg.hint()


def _evaluate(gnubgid):
    """Pozisyonun ham 6/5'li olasılık değerlendirmesi (hamle üretmeden)."""
    gnubg.setgnubgid(gnubgid)
    return {"gnubgid": gnubgid, "evaluate": gnubg.evaluate()}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # gnubg konsolunu kirletme
        pass

    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "service": "gnubg", "version": _gnubg_version()})
        self._send(404, {"error": "not-found"})

    def do_POST(self):
        if SECRET and self.headers.get("x-gnubg-secret") != SECRET:
            return self._send(401, {"error": "unauthorized"})
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            data = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except Exception as e:
            return self._send(400, {"error": "bad-json", "detail": str(e)})
        try:
            if self.path == "/hint":
                gid = data.get("gnubgid")
                if not gid:
                    return self._send(400, {"error": "gnubgid gerekli"})
                return self._send(200, _hint_for(gid, data.get("plies")))
            if self.path == "/evaluate":
                gid = data.get("gnubgid")
                if not gid:
                    return self._send(400, {"error": "gnubgid gerekli"})
                return self._send(200, _evaluate(gid))
            self._send(404, {"error": "not-found"})
        except Exception as e:
            self._send(500, {"error": "gnubg-error", "detail": str(e)})


def _gnubg_version():
    try:
        return gnubg.command("show version") or "gnubg"
    except Exception:
        return "gnubg"


def main():
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    # gnubg -p bu çağrıda BLOKLAR -> gnubg açık kalır, istekleri sırayla işler.
    srv.serve_forever()


main()
