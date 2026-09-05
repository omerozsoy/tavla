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


def _match_fields(ci, pi):
    """cubeinfo()+posinfo() -> encode_match_id alanlari. gnubg: cubeowner -1=merkez(->3),
    move/turn 0|1, dice [d0,d1], matchto=match uzunlugu, score [s0,s1]."""
    ci = ci or {}
    pi = pi or {}
    cube = ci.get("cube", 1) or 1
    owner = ci.get("cubeowner", -1)
    dice = pi.get("dice", [0, 0]) or [0, 0]
    score = ci.get("score", [0, 0]) or [0, 0]
    turn = 1 if pi.get("turn", 0) == 1 else 0
    return {
        "cube_loglevel": _log2_int(cube),
        "cube_owner": 3 if owner is None or owner < 0 else int(owner),
        "player_on_roll": turn,
        "crawford": 1 if ci.get("crawford") else 0,
        "game_state": int(pi.get("gamestate", 1) or 0),
        "player_on_move": turn,
        "doubled": 1 if pi.get("doubled") else 0,
        "resigned": int(pi.get("resigned", 0) or 0),
        "dice0": int(dice[0]) if len(dice) > 0 else 0,
        "dice1": int(dice[1]) if len(dice) > 1 else 0,
        "match_length": int(ci.get("matchto", 0) or 0),
        "score0": int(score[0]) if len(score) > 0 else 0,
        "score1": int(score[1]) if len(score) > 1 else 0,
    }


def _selftest(walk=40):
    """Encoder dogrulama: bir maci gercek pozisyonlarla yuru; her adimda
      (1) PositionID: encode_position_id(board()) == positionid() ?
      (2) MatchID round-trip: setgnubgid(pid + ':' + kendi_matchid) sonrasi gnubg ayni
          kup/skor/sira/zar'i geri okuyor mu ? (byte-exact sart degil; fonksiyonel dogruluk)
    Ilk uyusmazligi + ham yapilari dondurur."""
    pos_tested = pos_ok = 0
    pos_first_mismatch = None
    mid_tested = mid_rt_ok = mid_exact = 0
    mid_first_mismatch = None
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
            orig_gid = gnubg.gnubgid()
            ci = gnubg.cubeinfo()
            pi = gnubg.posinfo()

            # (1) PositionID encoder
            mine_pid = encode_position_id(board)
            pos_tested += 1
            if mine_pid == pid:
                pos_ok += 1
            elif pos_first_mismatch is None:
                pos_first_mismatch = {"step": step, "gnubg": pid, "mine": mine_pid,
                                      "board": [list(board[0]), list(board[1])]}

            # (2) MatchID encoder (round-trip + byte-exact bilgi amacli)
            fields = _match_fields(ci, pi)
            mine_mid = encode_match_id(fields)
            gnubg_mid = gnubg.matchid()
            mid_tested += 1
            if mine_mid == gnubg_mid:
                mid_exact += 1
            rt_ok = True
            rt_detail = None
            try:
                gnubg.setgnubgid(pid + ":" + mine_mid)
                ci2 = gnubg.cubeinfo()
                pi2 = gnubg.posinfo()
                checks = {
                    "cube": ci2.get("cube") == ci.get("cube"),
                    "cubeowner": ci2.get("cubeowner") == ci.get("cubeowner"),
                    "matchto": ci2.get("matchto") == ci.get("matchto"),
                    "score": list(ci2.get("score", [])) == list(ci.get("score", [])),
                    "turn": pi2.get("turn") == pi.get("turn"),
                    "dice": sorted(pi2.get("dice", [])) == sorted(pi.get("dice", [])),
                    "crawford": ci2.get("crawford") == ci.get("crawford"),
                }
                rt_ok = all(checks.values())
                if not rt_ok:
                    rt_detail = {"checks": checks, "read_cubeinfo": _safe(ci2), "read_posinfo": _safe(pi2)}
            except Exception as e:
                rt_ok = False
                rt_detail = {"error": str(e)}
            finally:
                gnubg.setgnubgid(orig_gid)  # yuruyusu bozma -> durumu geri yukle
            if rt_ok:
                mid_rt_ok += 1
            elif mid_first_mismatch is None:
                mid_first_mismatch = {"step": step, "fields": fields, "mine": mine_mid,
                                      "gnubg": gnubg_mid, "detail": rt_detail}

            if raw_dumps is None:
                raw_dumps = {
                    "positionid": pid, "matchid": gnubg_mid, "mine_matchid": mine_mid,
                    "gnubgid": orig_gid, "board": [list(board[0]), list(board[1])],
                    "cubeinfo": _safe(ci), "posinfo": _safe(pi), "fields": fields,
                }
            if len(samples) < 4:
                samples.append(orig_gid)
            gnubg.command("play")
        except Exception:
            try:
                gnubg.command("new game")
            except Exception:
                pass
    return {
        "position_encoder": {"tested": pos_tested, "passed": pos_ok, "first_mismatch": pos_first_mismatch},
        "match_encoder": {"tested": mid_tested, "roundtrip_passed": mid_rt_ok,
                          "byte_exact": mid_exact, "first_mismatch": mid_first_mismatch},
        "raw_dumps": raw_dumps,
        "samples": samples,
    }


# =====================================================================================
# YAPISAL KONUM -> gnubgid (GnuBgAdapter cekirdegi). Backend'in gonderdigi kanonik konumu
# gnubg koduna cevirir. Tahta yonelimi (acilistan dogrulandi):
#   points[i] (i=0..23, ucgen i+1; beyaz +, siyah -), bar{white,black}, off, turn, dice,
#   cube{value,owner}, score{white,black}, matchLength, crawford.
#   white_board[p] = max(0, points[p]);           white_board[24] = bar.white
#   black_board[p] = max(0, -points[23-p]);        black_board[24] = bar.black
#   gnubg tuple = (on-roll, rakip); on-roll = gnubg oyuncu 0 (fMove=fTurn=0).
# =====================================================================================


def _structured_to_boards(pos):
    pts = pos["points"]
    bar = pos.get("bar", {}) or {}
    white = [0] * 25
    black = [0] * 25
    for p in range(24):
        v = int(pts[p])
        if v > 0:
            white[p] = v
        elif v < 0:
            black[23 - p] = -v
    white[24] = int(bar.get("white", 0) or 0)
    black[24] = int(bar.get("black", 0) or 0)
    return white, black


def structured_to_gnubgid(pos):
    white, black = _structured_to_boards(pos)
    turn = pos.get("turn", "white")
    onroll_white = (turn == "white")
    onroll = white if onroll_white else black
    opp = black if onroll_white else white
    posid = encode_position_id((onroll, opp))  # on-roll = gnubg oyuncu 0

    cube = pos.get("cube", {}) or {}
    owner = cube.get("owner", None)
    cube_owner = 3 if owner is None else (0 if owner == turn else 1)
    dice = pos.get("dice", []) or []
    score = pos.get("score", {}) or {}
    opp_color = "black" if onroll_white else "white"
    fields = {
        "cube_loglevel": _log2_int(int(cube.get("value", 1) or 1)),
        "cube_owner": cube_owner,
        "player_on_roll": 0,
        "crawford": 1 if pos.get("crawford") else 0,
        "game_state": 1,
        "player_on_move": 0,
        "doubled": 0,
        "resigned": 0,
        "dice0": int(dice[0]) if len(dice) > 0 else 0,
        "dice1": int(dice[1]) if len(dice) > 1 else 0,
        "match_length": int(pos.get("matchLength", 0) or 0),
        "score0": int(score.get(turn, 0) or 0),
        "score1": int(score.get(opp_color, 0) or 0),
    }
    return posid + ":" + encode_match_id(fields)


def _set_plies(plies):
    if plies is None:
        return
    try:
        gnubg.command("set evaluation chequer evaluation plies %d" % int(plies))
    except Exception:
        pass


_SIGN = {"white": 1, "black": -1}


def _apply_our_steps(points, bar, steps, turn):
    """Oynanan Step[]'i (bizim format: from 0-23|'bar', to 0-23|'off') uygula -> yeni points+bar.
    Vurus (tek rakip tasi) dahil. points: 24 isaretli (beyaz +, siyah -)."""
    pts = [int(x) for x in points]
    b = {"white": int((bar or {}).get("white", 0) or 0), "black": int((bar or {}).get("black", 0) or 0)}
    sign = _SIGN[turn]
    opp = "black" if turn == "white" else "white"
    for st in steps:
        frm = st.get("from")
        to = st.get("to")
        if frm == "bar":
            b[turn] -= 1
        else:
            pts[int(frm)] -= sign
        if to != "off":
            t = int(to)
            if pts[t] == -sign:  # tek rakip tasi -> vur (bara gonder)
                pts[t] = 0
                b[opp] += 1
            pts[t] += sign
    return pts, b


def _points_to_boards(pts, bar):
    white = [0] * 25
    black = [0] * 25
    for p in range(24):
        v = int(pts[p])
        if v > 0:
            white[p] = v
        elif v < 0:
            black[23 - p] = -v
    white[24] = int((bar or {}).get("white", 0) or 0)
    black[24] = int((bar or {}).get("black", 0) or 0)
    return white, black


def _after_positionid(pos, steps):
    """Oynanan hamleden SONRAKI pozisyonun gnubg positionid'i (sira rakibe gecti)."""
    turn = pos.get("turn", "white")
    pts, bar = _apply_our_steps(pos["points"], pos.get("bar", {}), steps, turn)
    white, black = _points_to_boards(pts, bar)
    opp_is_white = (turn == "black")  # yeni on-roll = rakip
    onroll = white if opp_is_white else black
    other = black if opp_is_white else white
    return encode_position_id((onroll, other))


def _match_played(gid, dice, cand, played_rid):
    """Her adayi gnubg'de kendi notasyonuyla oynat, sonuc positionid'i played_rid ile eslesen adayi bul."""
    for c in cand:
        mv = c.get("move")
        if not mv:
            continue
        try:
            gnubg.setgnubgid(gid)
            if len(dice) >= 2:
                gnubg.command("set dice %d %d" % (int(dice[0]), int(dice[1])))
            gnubg.command("move " + mv)
            if gnubg.positionid() == played_rid:
                return c
        except Exception:
            continue
    return None


def _analyze(pos):
    """Yapisal konum -> gnubgid -> setgnubgid -> (ply) -> hint. Ham hint + gnubgid doner.
    playedSteps verilirse oynanan adayi (sonuc-pozisyonu eslestirmesiyle) bulur ve equity kaybini
    ekler (PR icin: loss = best_eq - played_eq, EMG). Normalizasyon backend GnuBgAdapter'da."""
    gid = structured_to_gnubgid(pos)
    gnubg.setgnubgid(gid)
    _set_plies(pos.get("plies"))
    hint = gnubg.hint()
    out = {"gnubgid": gid, "result": hint}

    steps = pos.get("playedSteps")
    if steps and isinstance(hint, dict) and hint.get("hint"):
        cand = hint["hint"]
        best_eq = cand[0].get("equity")
        try:
            played_rid = _after_positionid(pos, steps)
        except Exception as e:
            out["played"] = {"error": "apply-failed: %s" % e}
            return out
        matched = _match_played(gid, pos.get("dice", []) or [], cand, played_rid)
        gnubg.setgnubgid(gid)  # durumu geri yukle
        if matched is not None:
            peq = matched.get("equity") or 0.0
            out["played"] = {
                "move": matched.get("move"), "equity": peq, "eqdiff": matched.get("eqdiff"),
                "loss": max(0.0, (best_eq or 0.0) - peq),
            }
        else:
            out["played"] = {"matched": False, "played_positionid": played_rid}
    return out


def _maptest():
    """GameState->gnubgid esleme + yonelim dogrulamasi: acilis 3-1 -> en iyi 8/5 6/5 olmali.
    Iki tarafi da test eder (beyaz/siyah on-roll simetrik)."""
    opening = [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2]
    tests = [
        {"name": "acilis beyaz 3-1", "points": opening, "turn": "white", "dice": [3, 1], "matchLength": 5},
        {"name": "acilis siyah 3-1", "points": opening, "turn": "black", "dice": [3, 1], "matchLength": 5},
    ]
    out = []
    for t in tests:
        try:
            gid = structured_to_gnubgid(t)
            gnubg.setgnubgid(gid)
            _set_plies(2)
            h = gnubg.hint()
            cand = h.get("hint") if isinstance(h, dict) else None
            out.append({
                "name": t["name"], "best_move": (cand[0].get("move") if cand else None),
                "expected_best": "8/5 6/5",
            })
        except Exception as e:
            out.append({"name": t["name"], "error": str(e)})

    # Oynanan-hamle eslestirme + kayip (PR cekirdegi): 8/5 6/5 -> kayip ~0; 24/20 -> ~0.237.
    played_tests = [
        ("oynanan 8/5 6/5 (en iyi)", [{"from": 7, "to": 4, "die": 3}, {"from": 5, "to": 4, "die": 1}], "8/5 6/5"),
        ("oynanan 24/20 (zayif)", [{"from": 23, "to": 22, "die": 1}, {"from": 22, "to": 19, "die": 3}], "24/20"),
    ]
    for name, steps, exp_move in played_tests:
        try:
            res = _analyze({"points": opening, "turn": "white", "dice": [3, 1],
                            "matchLength": 5, "plies": 2, "playedSteps": steps})
            out.append({"name": name, "expected_move": exp_move, "played": res.get("played")})
        except Exception as e:
            out.append({"name": name, "error": str(e)})
    return {"maptest": out}


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
        if self.path == "/maptest":
            return self._send(200, _maptest())
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
            if self.path == "/analyze":
                if not data.get("points"):
                    return self._send(400, {"error": "points gerekli (24 uzunlukta yapisal konum)"})
                return self._send(200, _analyze(data))
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
