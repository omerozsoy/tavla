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
import random as _random
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import gnubg  # gnubg'nin gömülü Python modülü (yalnız `gnubg -p` içinde vardır)
except ImportError:  # düz python ile çalıştırılırsa anlamlı hata
    raise SystemExit("Bu betik gnubg gömülü Python'unda çalışmalı: gnubg -t -q -p gnubg_service.py")

PORT = int(os.environ.get("GNUBG_PORT", "8092"))
SECRET = os.environ.get("GNUBG_SECRET", "")

# =====================================================================================
# GNU Backgammon PositionID / MatchID ENCODER (kilit taşı) — bizim yapısal konumumuzu
# gnubg'nin kanonik "PositionID:MatchID" koduna çevirir ki setgnubgid(id) ile pozisyonu
# BİREBİR kurup hint/rollout alalım. GNU'ya özgü serileştirme burada kalır (adapter §4).
#
# DOĞRULAMA: /selftest gnubg'nin KENDİ positionid()/matchid()'siyle karşılaştırır (ground
# truth). encode_position_id(gnubg.board()) == gnubg.positionid() olmalı; olmazsa bit/sıra
# düzeltilir (mismatch ayrıntısı /selftest çıktısında).
# =====================================================================================

_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def _base64_std(data):
    # Standart base64 (big-endian, padding'siz). 10 bayt -> 14 char (PositionID),
    # 9 bayt -> 12 char (MatchID).
    out = []
    for i in range(0, len(data), 3):
        chunk = data[i:i + 3]
        b0 = chunk[0]
        b1 = chunk[1] if len(chunk) > 1 else 0
        b2 = chunk[2] if len(chunk) > 2 else 0
        out.append(_B64[b0 >> 2])
        out.append(_B64[((b0 & 3) << 4) | (b1 >> 4)])
        if len(chunk) > 1:
            out.append(_B64[((b1 & 15) << 2) | (b2 >> 6)])
        if len(chunk) > 2:
            out.append(_B64[b2 & 63])
    return "".join(out)


def position_key_bytes(board):
    # board = (side0[25], side1[25]) — gnubg.board() sırası; index 24 = bar.
    # Her nokta: n adet 1-bit + 1 ayraç 0-bit; LSB-first, 10 bayt (80 bit).
    key = bytearray(10)
    bit = 0
    for side in board:
        for j in range(25):
            for _ in range(int(side[j])):
                key[bit >> 3] |= 1 << (bit & 7)
                bit += 1
            bit += 1  # ayraç 0-bit
    return bytes(key)


def encode_position_id(board):
    return _base64_std(position_key_bytes(board))


def _log2_int(v):
    n = 0
    v = int(v)
    while v > 1:
        v >>= 1
        n += 1
    return n


def encode_match_id(f):
    # MatchID bit düzeni (LSB-first): cube log2(4) + cube owner(2) + player_on_roll(1) +
    # crawford(1) + game_state(3) + player_on_move(1) + doubled(1) + resigned(2) +
    # dice0(3) + dice1(3) + match_length(15) + score0(15) + score1(15) = 66 bit -> 9 bayt.
    # PROVİZYONEL: alan/anahtar eşlemesi /selftest raw_dumps ile kesinleştirilecek.
    bits = []

    def put(value, nbits):
        value = int(value)
        for k in range(nbits):
            bits.append((value >> k) & 1)

    put(f.get("cube_loglevel", 0), 4)
    put(f.get("cube_owner", 3), 2)
    put(f.get("player_on_roll", 0), 1)
    put(1 if f.get("crawford") else 0, 1)
    put(f.get("game_state", 1), 3)
    put(f.get("player_on_move", 0), 1)
    put(1 if f.get("doubled") else 0, 1)
    put(f.get("resigned", 0), 2)
    put(f.get("dice0", 0), 3)
    put(f.get("dice1", 0), 3)
    put(f.get("match_length", 0), 15)
    put(f.get("score0", 0), 15)
    put(f.get("score1", 0), 15)
    while len(bits) % 8:
        bits.append(0)
    data = bytearray((len(bits) + 7) // 8)
    for i, b in enumerate(bits):
        if b:
            data[i >> 3] |= 1 << (i & 7)
    return _base64_std(bytes(data))


def _safe(obj):
    try:
        json.dumps(obj)
        return obj
    except Exception:
        return str(obj)

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


def _selftest(walk=40):
    """Encoder'ı gnubg'nin KENDİ positionid()'siyle doğrula: bir maçı gerçek pozisyonlarla
    yürü, her adımda encode_position_id(board()) == positionid() mi bak. İlk uyuşmazlığı +
    cubeinfo()/posinfo() ham yapısını (MatchID encoder tasarımı için) döndür."""
    pos_tested = pos_ok = 0
    first_mismatch = None
    raw_dumps = None
    samples = []
    try:
        gnubg.command("set player 0 human")
        gnubg.command("set player 1 human")
        gnubg.command("new match 5")
    except Exception as e:
        return {"error": "setup-failed", "detail": str(e)}
    for step in range(walk):
        try:
            gnubg.command("set dice %d %d" % (_random.randint(1, 6), _random.randint(1, 6)))
            board = gnubg.board()
            pid = gnubg.positionid()
            mine = encode_position_id(board)
            pos_tested += 1
            if mine == pid:
                pos_ok += 1
            elif first_mismatch is None:
                first_mismatch = {
                    "step": step, "gnubg_positionid": pid, "mine": mine,
                    "board": [list(board[0]), list(board[1])],
                }
            if raw_dumps is None:
                ci = pi = None
                try:
                    ci = gnubg.cubeinfo()
                except Exception:
                    pass
                try:
                    pi = gnubg.posinfo()
                except Exception:
                    pass
                raw_dumps = {
                    "positionid": pid, "matchid": gnubg.matchid(), "gnubgid": gnubg.gnubgid(),
                    "board": [list(board[0]), list(board[1])],
                    "cubeinfo": _safe(ci), "posinfo": _safe(pi),
                }
            if len(samples) < 4:
                samples.append(gnubg.gnubgid())
            gnubg.command("play")
        except Exception:
            try:
                gnubg.command("new game")
            except Exception:
                pass
    return {
        "position_encoder": {"tested": pos_tested, "passed": pos_ok, "first_mismatch": first_mismatch},
        "raw_dumps": raw_dumps,
        "samples": samples,
    }


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
        if self.path == "/selftest":
            return self._send(200, _selftest())
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
