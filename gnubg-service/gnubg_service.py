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
import re  # modül düzeyi regex derlemeleri (luck parse) için — eskiden yalnız fonksiyon-içiydi
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
    # gnubg her zaman anBoard[1]'i (slot1) hamle-yapan sayar; board()=(RAKİP, on-roll). Bu yüzden
    # on-roll SLOT1'e, rakip SLOT0'a. BUG FIX 2026-09-05: eskiden (on-roll, opp) idi -> gnubg slot1'deki
    # RAKİBİ analiz ediyordu (beyazda simetrik açılış gizledi; siyahta no_match + self-play çökmesi).
    posid = encode_position_id((opp, onroll))

    # matchid PLAYER-INDEX tabanlı: player0=beyaz, player1=siyah. On-roll'ı fMove/fTurn BELİRTİR.
    # BUG FIX 2026-09-05: eskiden fMove HEP 0'dı -> beyaz on-roll'da tesadüfen doğru (beyaz=oyuncu0)
    # ama SİYAH on-roll'da gnubg pozisyonu on-roll perspektifinde okuyup YANLIŞ oyuncuyu (beyazı)
    # analiz ediyordu -> siyahın hamleleri eşleşmiyordu (no_match). Beyaz etkilenmez.
    on_roll_idx = 0 if onroll_white else 1
    cube = pos.get("cube", {}) or {}
    owner = cube.get("owner", None)
    cube_owner = 3 if owner is None else (0 if owner == "white" else 1)
    dice = pos.get("dice", []) or []
    score = pos.get("score", {}) or {}
    fields = {
        "cube_loglevel": _log2_int(int(cube.get("value", 1) or 1)),
        "cube_owner": cube_owner,
        "player_on_roll": on_roll_idx,
        "crawford": 1 if pos.get("crawford") else 0,
        "game_state": 1,
        "player_on_move": on_roll_idx,
        "doubled": 0,
        "resigned": 0,
        "dice0": int(dice[0]) if len(dice) > 0 else 0,
        "dice1": int(dice[1]) if len(dice) > 1 else 0,
        "match_length": int(pos.get("matchLength", 0) or 0),
        "score0": int(score.get("white", 0) or 0),
        "score1": int(score.get("black", 0) or 0),
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


def _gnubg_point_to_index(turn, tok):
    """gnubg/mat mover-noktasi -> bizim ucgen index (0-23) / 'bar' / 'off'.
    'bar'/'off' string VEYA sayisal dialect: 25=bar, 0=off (XG/.mat). 1-24: beyaz P-1, siyah 24-P."""
    if tok == "bar":
        return "bar"
    if tok == "off":
        return "off"
    p = int(tok)
    if p == 25:  # sayisal dialect: 25 = bar (giris noktasi)
        return "bar"
    if p == 0:   # sayisal dialect: 0 = off (toplama)
        return "off"
    return (p - 1) if turn == "white" else (24 - p)


def _parse_gnubg_move_to_steps(turn, notation):
    """gnubg hamle notasyonu ('8/5 6/5', 'bar/20', '6/off', '13/7*/2', '24/18(2)') -> bizim Step[].
    '*' (vurus) ve '(n)' (n kopya) islenir; zincir 'a/b/c' -> a->b, b->c (tahta icin ara onemsiz)."""
    steps = []
    for token in notation.split():
        token = token.replace("*", "")
        count = 1
        if "(" in token:
            base, _, rest = token.partition("(")
            count = int(rest.rstrip(")") or "1")
            token = base
        parts = token.split("/")
        for _ in range(count):
            for i in range(len(parts) - 1):
                steps.append({
                    "from": _gnubg_point_to_index(turn, parts[i]),
                    "to": _gnubg_point_to_index(turn, parts[i + 1]),
                    "die": 0,
                })
    return steps


def _boards_after(pos, steps):
    """pos + Step[] -> (white_board, black_board) [25'er, index24=bar]."""
    pts, bar = _apply_our_steps(pos["points"], pos.get("bar", {}), steps, pos.get("turn", "white"))
    return _points_to_boards(pts, bar)


def _match_played(pos, cand, white_after, black_after):
    """Her adayin notasyonunu PARSE edip tahtasini hesapla; oynanan tahtayla eslesen adayi bul (saf Python)."""
    for c in cand:
        mv = c.get("move")
        if not mv:
            continue
        try:
            cw, cb = _boards_after(pos, _parse_gnubg_move_to_steps(pos.get("turn", "white"), mv))
            if cw == white_after and cb == black_after:
                return c
        except Exception:
            continue
    return None


def _analyze(pos):
    """Yapisal konum -> gnubgid -> setgnubgid -> (ply) -> hint. Ham hint + gnubgid doner.
    playedSteps verilirse oynanan adayi (sonuc-TAHTASI eslestirmesiyle) bulur ve equity kaybini
    ekler (PR icin: loss = best_eq - played_eq, EMG). Normalizasyon backend GnuBgAdapter'da."""
    gid = structured_to_gnubgid(pos)
    gnubg.setgnubgid(gid)
    # Zar yoksa -> KÜP kararı (gnubg.hint() küp desteklemiyor; 'hint' metnini parse et).
    if len([d for d in (pos.get("dice", []) or []) if d]) < 2:
        return _cube_result(gid)
    _set_plies(pos.get("plies"))
    hint = gnubg.hint()
    out = {"gnubgid": gid, "result": hint}

    steps = pos.get("playedSteps")
    if steps and isinstance(hint, dict) and hint.get("hint"):
        cand = hint["hint"]
        best_eq = cand[0].get("equity")
        try:
            white_after, black_after = _boards_after(pos, steps)
        except Exception as e:
            out["played"] = {"error": "apply-failed: %s" % e}
            return out
        matched = _match_played(pos, cand, white_after, black_after)
        if matched is not None:
            peq = matched.get("equity") or 0.0
            out["played"] = {
                "move": matched.get("move"), "equity": peq, "eqdiff": matched.get("eqdiff"),
                "loss": max(0.0, (best_eq or 0.0) - peq),
            }
        else:
            dbg = {"turn": pos.get("turn"), "gnubgid": gid,
                   "all_moves": [c.get("move") for c in cand]}
            try:
                gb = gnubg.board()  # gnubg'nin analiz ettiği GERÇEK tahta (structured_to_gnubgid sonucu)
                dbg["gnubg_board"] = [list(gb[0]), list(gb[1])]
            except Exception as e:
                dbg["board_err"] = str(e)
            out["played"] = {"matched": False, "white_after": white_after,
                             "black_after": black_after, "debug": dbg}
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


def _capture_command(cmd):
    """gnubg.command() çıktısı C-stdout'a (fd 1) yazılır; fd 1'i geçici dosyaya yönlendirip yakala."""
    import os
    import tempfile

    path = os.path.join(tempfile.gettempdir(), "gnubg_capture.txt")
    old = os.dup(1)
    f = open(path, "w")
    try:
        os.dup2(f.fileno(), 1)
        try:
            gnubg.command(cmd)
        except Exception:
            pass
    finally:
        os.dup2(old, 1)
        os.close(old)
        f.close()
    try:
        with open(path) as r:
            return r.read()
    except Exception:
        return ""


def _parse_cube_text(text):
    """gnubg 'hint' metnindeki KÜP analizinden aksiyon equity'lerini çıkar:
      1. No double     +0.385
      2. Double, pass  +1.000
      3. Double, take  +0.301
    -> {equities:{noDouble,doublePass,doubleTake}, proper, raw}."""
    import re

    names = {
        "No double": "noDouble", "No redouble": "noDouble",
        "Double, pass": "doublePass", "Redouble, pass": "doublePass",
        "Double, take": "doubleTake", "Redouble, take": "doubleTake",
        "Too good to double, pass": "doublePass", "Too good to double, take": "doubleTake",
    }
    eq = {}
    for line in (text or "").splitlines():
        m = re.match(r"\s*\d+\.\s+(.+?)\s+([+-]?\d+\.\d+)", line)
        if m:
            key = names.get(m.group(1).strip())
            if key and key not in eq:
                eq[key] = float(m.group(2))
    proper = None
    for line in (text or "").splitlines():
        if "Proper cube action:" in line:
            proper = line.split(":", 1)[1].strip()
    return {"equities": eq, "proper": proper, "raw": text}


def _cube_result(gid):
    """Kup kararı analizi: gnubg 'hint' metnini yakala + parse et (hint() küp desteklemiyor).
    'evaluate' = pozisyonun ham 5'li kümülatif olasılığı (W,WG,WB,LG,LB) — Pozisyon Analizi
    ekranı zarsız durumda kazanma % göstermek için kullanır (setgnubgid çağıran zaten yaptı)."""
    out = {"gnubgid": gid, "cube": _parse_cube_text(_capture_command("hint"))}
    try:
        out["evaluate"] = _safe(gnubg.evaluate())
    except Exception as e:
        out["evaluate_err"] = str(e)
    return out


def _cubetest(pos):
    """KÜP kararı teşhisi. gnubg.hint() KÜP'ü desteklemiyor ('not implemented'); bu yüzden:
    (1) gnubg.evaluate() ham değerlendirme, (2) 'hint' KOMUTUNUN metin çıktısı (CLI küp analizini
    yazar; fd-yakalama ile alınır), (3) cubeinfo. Bu yapıya göre cube PR yazılacak."""
    out = {}
    try:
        gid = structured_to_gnubgid(pos)
        out["gnubgid"] = gid
        gnubg.setgnubgid(gid)
    except Exception as e:
        out["setgnubgid_err"] = str(e)
        return out
    try:
        out["evaluate"] = _safe(gnubg.evaluate())
    except Exception as e:
        out["evaluate_err"] = str(e)
    try:
        out["hint_text"] = _capture_command("hint")
    except Exception as e:
        out["hint_text_err"] = str(e)
    try:
        out["cubeinfo"] = _safe(gnubg.cubeinfo())
    except Exception as e:
        out["info_err"] = str(e)
    return out


def _rollouttest(pos, trials=36):
    """ROLLOUT teşhisi: pozisyonu kur, küçük bir rollout çalıştır, çıktıyı (fd-yakalama) döndür.
    gnubg rollout API/çıktı formatını görmek için (adaptive rollout tırmanmasını buna göre yazacağım).
    rollout PAHALI -> yalnız teşhis/az trial."""
    out = {}
    try:
        gid = structured_to_gnubgid(pos)
        out["gnubgid"] = gid
        gnubg.setgnubgid(gid)
    except Exception as e:
        out["setgnubgid_err"] = str(e)
        return out
    try:
        gnubg.command("set rollout trials %d" % int(trials))
    except Exception as e:
        out["set_trials_err"] = str(e)
    # rollout metni C-stdout'a yazılır -> fd-yakalama ile al. (Önce hint move listesini kurabilir.)
    out["hint_text"] = _capture_command("hint")
    out["rollout_text"] = _capture_command("rollout")
    return out


def _initial_pos():
    return {
        "points": [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2],
        "bar": {"white": 0, "black": 0},
        "off": {"white": 0, "black": 0},
        "turn": "white",
    }


def _play_auto_match(points_match=1, steps_out=None):
    """İki gnubg botu (0-ply) verilen uzunlukta bir maç oynar. Oyunları elle ilerletir."""
    def _cmd(c):
        try:
            gnubg.command(c)
            if steps_out is not None:
                steps_out.append({"cmd": c, "ok": True})
        except Exception as e:
            if steps_out is not None:
                steps_out.append({"cmd": c, "ok": False, "err": str(e)})
    _cmd("set player 0 gnubg")
    _cmd("set player 1 gnubg")
    _cmd("set player 0 chequer evaluation plies 0")
    _cmd("set player 1 chequer evaluation plies 0")
    _cmd("set analysis luck on")
    _cmd("set analysis moves on")
    _cmd("set automatic roll on")
    _cmd("set automatic game off")
    _cmd("new match %d" % int(points_match))
    plays = 0
    for _ in range(4000):
        try:
            gnubg.command("play")
            plays += 1
        except Exception:
            try:
                gnubg.command("new game")
            except Exception:
                break
    return plays


# İşaret OPSİYONEL ([+-]?) — gnubg işaretsiz sıfır (0.000) veya format varyantı yazarsa da eşleşsin.
_LUCK_TOTAL_RE = re.compile(
    r"Luck total EMG \(MWC\)\s+([+-]?[\d.]+)\s+\(\s*([+-]?[\d.]+)%\)\s+([+-]?[\d.]+)\s+\(\s*([+-]?[\d.]+)%\)")
_LUCK_RATE_RE = re.compile(
    r"Luck rate mEMG \(MWC\)\s+([+-]?[\d.]+)\s+\(\s*([+-]?[\d.]+)%\)\s+([+-]?[\d.]+)\s+\(\s*([+-]?[\d.]+)%\)")
_PLAYER_HDR_RE = re.compile(r"^Player\s+(\S+)\s+(\S+)\s*$", re.M)


def _parse_luck_stats(stats):
    """'show statistics match' metninden per-oyuncu native luck'ı çıkar. Sütun 0 = ilk oyuncu
    (.mat'te white/soldaki), sütun 1 = ikinci (black/sağdaki). gnubg native: 0-ply cubeful."""
    out = {"names": None, "p0": None, "p1": None}
    if not stats:
        return out
    ph = _PLAYER_HDR_RE.search(stats)
    if ph:
        out["names"] = [ph.group(1), ph.group(2)]
    mt = _LUCK_TOTAL_RE.search(stats)
    mr = _LUCK_RATE_RE.search(stats)
    if mt:
        out["p0"] = {"emg_total": float(mt.group(1)), "mwc_total": float(mt.group(2))}
        out["p1"] = {"emg_total": float(mt.group(3)), "mwc_total": float(mt.group(4))}
    if mr:
        if out["p0"] is None:
            out["p0"] = {}
        if out["p1"] is None:
            out["p1"] = {}
        out["p0"].update({"emg_rate": float(mr.group(1)), "mwc_rate": float(mr.group(2))})
        out["p1"].update({"emg_rate": float(mr.group(3)), "mwc_rate": float(mr.group(4))})
    return out


# ---- Mat Analiz (tam maç analizi: özet istatistikler) --------------------------------
_MATCHLEN_RE = re.compile(r"(\d+)\s+point\s+match", re.I)


def _first_float(s):
    """Bir değer hücresinden ilk sayıyı çıkar ('-0.383 (-3.829%)' -> -0.383)."""
    m = re.search(r"[+-]?\d+(?:\.\d+)?", s or "")
    return float(m.group(0)) if m else None


def _parse_match_stats(stats):
    """gnubg 'show statistics match' metnini SÜRÜM-BAĞIMSIZ 2-sütunlu tablo olarak ayrıştır.
    Doner: {names:[p0,p1], sections:[{title, rows:[{label, values:[v0,v1]}]}]}. Etiketleri
    sabit-kodlamaz; başlıklar '... statistics:' satırlarıdır, veri satırları 2+ boşlukla ayrık."""
    out = {"names": None, "sections": []}
    if not stats:
        return out
    ph = _PLAYER_HDR_RE.search(stats)
    if ph:
        out["names"] = [ph.group(1), ph.group(2)]
    cur = None
    for raw in stats.splitlines():
        s = raw.strip()
        if not s:
            continue
        # Bölüm başlığı: 'Chequerplay statistics:', 'Cube statistics:', 'Overall statistics:' ...
        if re.match(r"(?i)^[a-z][a-z /]*statistics:?$", s):
            cur = {"title": s.rstrip(":"), "rows": []}
            out["sections"].append(cur)
            continue
        parts = re.split(r"\s{2,}", s)
        if len(parts) >= 2:
            if cur is None:
                cur = {"title": "", "rows": []}
                out["sections"].append(cur)
            cur["rows"].append({"label": parts[0], "values": parts[1:3]})
    return out


def _row_values(parsed, label_sub):
    """İlk etiketinde label_sub (küçük harf, contains) geçen satırın iki sütununu döndür."""
    ls = label_sub.lower()
    for sec in parsed.get("sections", []):
        for r in sec.get("rows", []):
            if ls in r["label"].lower():
                v = r.get("values", [])
                return [v[0] if len(v) > 0 else None, v[1] if len(v) > 1 else None]
    return [None, None]


def _sum_rows(parsed, label_sub):
    """label_sub ile başlayan/içeren TÜM satırların ilk sayısını per-oyuncu topla (Missed doubles)."""
    ls = label_sub.lower()
    tot = [0.0, 0.0]
    found = False
    for sec in parsed.get("sections", []):
        for r in sec.get("rows", []):
            if ls in r["label"].lower():
                v = r.get("values", [])
                for i in (0, 1):
                    f = _first_float(v[i]) if i < len(v) else None
                    if f is not None:
                        tot[i] += f
                        found = True
    return tot if found else [None, None]


def _player_summary(parsed, idx):
    """Bir oyuncu için özet metrikler (HedgeHog benzeri kartlar)."""
    def val(sub):
        return _first_float(_row_values(parsed, sub)[idx])

    blunders = val("marked very bad")
    errors = val("marked bad")
    inacc = val("marked doubtful")
    missed = _sum_rows(parsed, "missed double")
    return {
        "name": (parsed.get("names") or [None, None])[idx],
        "blunders": int(blunders) if blunders is not None else None,
        "errors": int(errors) if errors is not None else None,
        "inaccuracies": int(inacc) if inacc is not None else None,
        "missedDoubles": int(missed[idx]) if missed[idx] is not None else None,
        # Error rate (total) = kaybedilen eşitlik (EMG mutlak); (per move) = ER mEMG
        "equityLost": val("error rate (total)"),
        "erPerMove": val("error rate (per move)"),
        "snowieErrorRate": val("snowie error rate"),
        # Kategori dereceleri (kelime) — ham sütun (sayı değil)
        "chequerRating": _row_values(parsed, "chequerplay rating")[idx],
        "cubeRating": _row_values(parsed, "cube decision rating")[idx],
        "overallRating": _row_values(parsed, "overall rating")[idx],
    }


def _analyzematch(mat_text, plies=2):
    """Yüklenen .mat maçını gnubg ile TAM analiz edip özet istatistikleri döndürür.
    Doner: {ok, matchLength, names, players:[p0,p1 özet], stats:{sections}, statistics_match(raw)}."""
    out = {"ok": False, "import_cmd": None}
    if not mat_text or not mat_text.strip():
        out["error"] = "empty-mat"
        return out
    tmp = "/tmp/tavlai_analyze.mat"
    try:
        ml = _MATCHLEN_RE.search(mat_text)
        out["matchLength"] = int(ml.group(1)) if ml else None
        with open(tmp, "w") as f:
            f.write(mat_text)
        imported = False
        last_err = None
        for cmd in ("import mat " + tmp, "load match " + tmp):
            try:
                gnubg.command("new match 1")
            except Exception:
                pass
            try:
                gnubg.command(cmd)
                imported = True
                out["import_cmd"] = cmd
                break
            except Exception as e:
                last_err = str(e)
        if not imported:
            out["error"] = "import-failed"
            out["import_err"] = last_err
            return out
        # Analiz ayarları: hamle + küp + şans; derinlik (ply) iste.
        for c in (
            "set analysis moves on",
            "set analysis cube on",
            "set analysis luck on",
            "set analysis chequerplay evaluation plies %d" % int(plies),
            "set analysis cubedecision evaluation plies %d" % int(plies),
        ):
            try:
                gnubg.command(c)
            except Exception:
                pass
        gnubg.command("analyse match")
        stats = _capture_command("show statistics match")
        parsed = _parse_match_stats(stats)
        out["names"] = parsed.get("names")
        out["players"] = [_player_summary(parsed, 0), _player_summary(parsed, 1)]
        out["stats"] = {"sections": parsed.get("sections", [])}
        out["statistics_match"] = stats
        out["plies"] = int(plies)
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)
    return out


def _probs6_from_cumulative(p):
    """gnubg 5'li KÜMÜLATIF (win, wg, wb, lg, lb) -> frontend 6'lı DIŞLAYAN [wn,wg,wb,ln,lg,lb].
    AnalysisController::probs6 ile birebir (Mat Analiz hamle görüntüleyici aynı gösterimi kullanır)."""
    if not p or len(p) < 5:
        return None
    w, wg, wb, lg, lb = float(p[0]), float(p[1]), float(p[2]), float(p[3]), float(p[4])
    lose_any = max(0.0, 1.0 - w)
    return [max(0.0, w - wg), max(0.0, wg - wb), max(0.0, wb),
            max(0.0, lose_any - lg), max(0.0, lg - lb), max(0.0, lb)]


def _review_decision(pos_points, bar, off, turn, dice, played_steps, match_len, plies):
    """Tek bir taş-hamlesi kararını analiz et -> LogEntry-uyumlu dict (frontend MatchReport için).
    pos = analiz ÖNCESİ konum; played_steps = gerçekten oynanan adımlar. hint (gnubg) ile
    aday listesi + oynanan adayın kaybı hesaplanır (PR çekirdeğiyle aynı yol)."""
    entry = {
        "player": turn,
        "pos": {"points": list(pos_points), "bar": dict(bar), "off": dict(off), "turn": turn},
        "dice": list(dice),
        "playedSteps": played_steps,
        "notation": None, "best": None, "loss": 0.0, "cands": [], "probs": None,
    }
    try:
        gid = structured_to_gnubgid({"points": pos_points, "bar": bar, "turn": turn,
                                     "dice": dice, "matchLength": match_len})
        gnubg.setgnubgid(gid)
        _set_plies(plies)
        h = gnubg.hint()
        cand = h.get("hint") if isinstance(h, dict) else None
    except Exception as e:
        entry["error"] = str(e)
        cand = None
    if not cand:
        return entry
    best_eq = cand[0].get("equity") or 0.0
    cands = []
    for c in cand[:8]:
        mv = c.get("move") or ""
        cands.append({
            "notation": mv,
            "equity": float(c.get("equity") or 0.0),
            "steps": _parse_gnubg_move_to_steps(turn, mv),
            "probs": _probs6_from_cumulative((c.get("details") or {}).get("probs")),
        })
    entry["cands"] = cands
    entry["best"] = cands[0]["notation"] if cands else None
    entry["probs"] = cands[0]["probs"] if cands else None
    # Oynanan adayı sonuç-tahtası eşleşmesiyle bul (PR çekirdeği _match_played).
    try:
        white_after, black_after = _boards_after(
            {"points": pos_points, "bar": bar, "turn": turn}, played_steps)
        matched = _match_played({"points": pos_points, "bar": bar, "turn": turn},
                                cand, white_after, black_after)
    except Exception:
        matched = None
    if matched is not None:
        peq = matched.get("equity") or 0.0
        entry["notation"] = matched.get("move")
        entry["loss"] = max(0.0, (best_eq or 0.0) - peq)
        # Oynanan konumun kazanma olasılığı (probs): eşleşen adayınki
        entry["probs"] = _probs6_from_cumulative((matched.get("details") or {}).get("probs")) or entry["probs"]
    else:
        # Oynanan hamle top-8 dışında (büyük blunder) — notasyonu adımlardan üret (kaba) + kayıp bilinmiyor
        entry["notation"] = _steps_to_notation(turn, played_steps)
        entry["loss"] = 0.0
    return entry


def _steps_to_notation(turn, steps):
    """Bizim Step[] -> kaba gnubg-benzeri notasyon (yalnız oynanan hamle top listede yokken gösterim)."""
    def loc(idx):
        if idx == "bar":
            return "bar"
        if idx == "off":
            return "off"
        p = int(idx)
        return str(p + 1) if turn == "white" else str(24 - p)
    parts = ["%s/%s" % (loc(s.get("from")), loc(s.get("to"))) for s in (steps or [])]
    return " ".join(parts) if parts else "(pas)"


def _record_field(rec, *keys):
    """Bir gnubg.match() hamle kaydından ilk mevcut anahtarı döndür (sürüm alan-adı farkları için)."""
    if not isinstance(rec, dict):
        return None
    for k in keys:
        if k in rec and rec[k] is not None:
            return rec[k]
    return None


def _record_move_to_notation(rec, turn):
    """gnubg.match() hamle kaydındaki oynanan hamleyi notasyona çevir. 'move' str ise aynen;
    (from,to) çiftleri dizisi ise gnubg nokta no'suyla (25=bar, 0=off, 1-24 nokta) notasyon kur."""
    mv = _record_field(rec, "move", "moves", "action_move", "play")
    if isinstance(mv, str):
        return mv.strip() or None

    def gp(n):
        n = int(n)
        if n >= 25:
            return "bar"
        if n <= 0:
            return "off"
        return str(n)

    if isinstance(mv, (list, tuple)) and mv:
        # (from,to) çiftleri dizisi VEYA düz [from,to,from,to,...] tamsayı dizisi
        pairs = []
        if all(isinstance(x, (list, tuple)) and len(x) >= 2 for x in mv):
            pairs = [(x[0], x[1]) for x in mv]
        else:
            flat = [x for x in mv if isinstance(x, (int, float))]
            for i in range(0, len(flat) - 1, 2):
                pairs.append((flat[i], flat[i + 1]))
        toks = []
        for a, b in pairs:
            if int(a) == 0 and int(b) == 0:
                continue  # gnubg dolgu (0,0) = kullanılmayan zar
            toks.append("%s/%s" % (gp(a), gp(b)))
        return " ".join(toks) or None
    return None


def _find_move_list(game):
    """gnubg.match() bir oyunundaki hamle-kayıt listesini SÜRÜM-BAĞIMSIZ bul. game bir liste ise
    doğrudan; dict ise bilinen anahtarları dene, yoksa dict-listesi olan en uzun değeri kullan."""
    if isinstance(game, list):
        return game
    if not isinstance(game, dict):
        return None
    for k in ("game", "moves", "plays", "analysis", "records", "moveRecords"):
        v = game.get(k)
        if isinstance(v, list) and v:
            return v
    # Fallback: dict-öğeli en uzun liste değeri
    best = None
    for v in game.values():
        if isinstance(v, list) and v and any(isinstance(x, dict) for x in v):
            if best is None or len(v) > len(best):
                best = v
    return best


def _mat_entry(text):
    """.mat satirinin bir sutununu karara cevir: move / cube / result / None."""
    t = (text or "").strip()
    if not t:
        return None
    low = t.lower()
    _CUBE = {"doubles": "double", "takes": "take", "drops": "drop", "beavers": "beaver",
             "accepts": "take", "rejects": "drop"}
    for k, act in _CUBE.items():
        if low.startswith(k):
            return ("cube", act)
    if low.startswith("wins") or low.startswith("losses"):
        return ("result", None)
    m = re.match(r"^(\d+):\s*(.*)$", t)
    if m:
        d = m.group(1)
        dice = [int(d[0]), int(d[1])] if len(d) >= 2 else []
        return ("move", {"dice": dice, "notation": m.group(2).strip()})
    return None


_MAT_P1_RE = re.compile(r'Player\s*1\s*"([^"]*)"')
_MAT_P2_RE = re.compile(r'Player\s*2\s*"([^"]*)"')
_MAT_ROW_RE = re.compile(r"^\s*(\d+)\)(.*)$")
_MAT_GAME_RE = re.compile(r"^\s*Game\s+(\d+)\s*$", re.I)


def _parse_mat_games(mat_text):
    """.mat METNINI dogrudan ayristir (gnubg.match()'e GUVENME): iki sutun (sol=oyuncu1/beyaz,
    sag=oyuncu2/siyah); her karar dosya sirasinda. Doner (match_len, names, games) — games her
    oyun icin [(color, kind, data)] listesi. Bar=25/off=0 sayisal dialect _gnubg_point_to_index'te."""
    names = None
    p1 = _MAT_P1_RE.search(mat_text)
    p2 = _MAT_P2_RE.search(mat_text)
    if p1 and p2:
        names = [p1.group(1).strip() or "White", p2.group(1).strip() or "Black"]
    ml = _MATCHLEN_RE.search(mat_text)
    match_len = int(ml.group(1)) if ml else 0
    games = []
    cur = None
    col = None  # sag sutun mutlak karakter ofseti (her oyun basligindan tespit)
    for line in mat_text.splitlines():
        if _MAT_GAME_RE.match(line):
            cur = []
            games.append(cur)
            col = None
            continue
        # Oyun basligi "P1 : skor   P2 : skor" -> sag sutun ofsetini (col) ver (isim uzunlugu farki icin)
        if cur is not None and col is None:
            hm = re.match(r"^(\s*\S.*?:\s*-?\d+)\s{2,}(\S.*?:\s*-?\d+)\s*$", line)
            if hm:
                col = hm.start(2)
                continue
        rm = _MAT_ROW_RE.match(line)
        if not rm or cur is None:
            continue
        if col is not None and 0 < col <= len(line):
            # Mutlak sutun bolme (dinamik) — sol="N) <p1>" -> "N)" soyulur, sag=p2
            left = re.sub(r"^\s*\d+\)\s*", "", line[:col]).strip()
            right = line[col:].strip()
        else:
            # Yedek heuristik: 3+ bosluk bol + esik
            body = rm.group(2)
            lead = len(body) - len(body.lstrip())
            parts = re.split(r"\s{3,}", body.strip())
            if len(parts) >= 2:
                left, right = parts[0], parts[1]
            elif len(parts) == 1:
                left, right = ("", parts[0]) if lead >= 25 else (parts[0], "")
            else:
                left, right = "", ""
        le = _mat_entry(left)
        if le:
            cur.append(("white",) + le)
        rre = _mat_entry(right)
        if rre:
            cur.append(("black",) + rre)
    return match_len, names, games


def _reviewmatch(mat_text, plies=2):
    """Yuklenen .mat macini HAMLE-HAMLE analiz eder (Faz 2 goruntuleyici icin LogEntry[]).
    .mat METNINI dogrudan ayristirir (gnubg.match() yapisina bagli DEGIL); her oyunu baslangictan
    replay eder; her tas-hamlesini gnubg hint ile analiz eder (setgnubgid+hint; import gerekmez).
    Bozuk .mat'ta (tas sayisi != 15) o oyunu durdurup gecerli kismi tutar (cokme yok)."""
    out = {"ok": False, "log": []}
    if not mat_text or not mat_text.strip():
        out["error"] = "empty-mat"
        return out
    try:
        match_len, names, games = _parse_mat_games(mat_text)
        out["matchLength"] = match_len or None
        out["names"] = names
        log = []
        for gi, g in enumerate(games):
            pos = _initial_pos()
            cube_val = 1          # bu oyunun o anki küp değeri (kabul edilen her double -> ×2)
            cube_owner = None     # küp sahibi ('white'/'black'/None=merkez)
            for (color, kind, data) in g:
                if kind == "cube":
                    # Küp kararında da o anki tahta gösterilsin (frontend MatReview boardu):
                    # pos = karar ANINDAKİ tahta (küp tahtayı değiştirmez); küp değeri/sahibi iliştir.
                    snap = {"points": list(pos["points"]), "bar": dict(pos["bar"]),
                            "off": dict(pos["off"]), "turn": color,
                            "cube": {"value": cube_val, "owner": cube_owner}}
                    log.append({"player": color, "pos": snap,
                                "cube": {"chosen": data, "win": 0, "equity": 0,
                                "recommended": data, "correct": True}, "notation": data,
                                "best": data, "loss": 0.0, "seq": len(log), "game": gi})
                    if data == "take":  # double kabul edildi -> küp ikiye katlanır, alıcı sahibi
                        cube_val *= 2
                        cube_owner = color
                    continue
                if kind != "move":
                    continue
                notation = data["notation"]
                dice = data["dice"]
                if not notation:  # dance / no move (zar var, hamle yok) -> tahta + zar gösterilsin
                    snap = {"points": list(pos["points"]), "bar": dict(pos["bar"]),
                            "off": dict(pos["off"]), "turn": color,
                            "cube": {"value": cube_val, "owner": cube_owner}}
                    log.append({"player": color, "dice": dice, "notation": "(no move)",
                                "pos": snap, "best": None, "loss": 0.0, "seq": len(log), "game": gi})
                    continue
                try:
                    steps = _parse_gnubg_move_to_steps(color, notation)
                except Exception:
                    break  # bozuk notasyon -> bu oyunu durdur
                if len(dice) < 2 or not steps:
                    continue
                # Konumu ilerlet + gecerlilik denetimi (analizden ONCE; bozuksa hamleyi ATLA+dur)
                try:
                    pts, bar = _apply_our_steps(pos["points"], pos["bar"], steps, color)
                except Exception:
                    break
                off = dict(pos["off"])
                off[color] += sum(1 for s in steps if s.get("to") == "off")
                w = sum(x for x in pts if x > 0) + bar["white"] + off["white"]
                b = sum(-x for x in pts if x < 0) + bar["black"] + off["black"]
                if w != 15 or b != 15:
                    break  # bozuk .mat -> bu oyunu durdur (gecerli kisim korunur)
                # Analiz: karar ONCESI pozisyon
                e = _review_decision(pos["points"], pos["bar"], pos["off"], color, dice,
                                     steps, match_len, plies)
                if isinstance(e.get("pos"), dict):  # tahtada doğru küp görünsün (double sonrası)
                    e["pos"]["cube"] = {"value": cube_val, "owner": cube_owner}
                e["seq"] = len(log)
                e["game"] = gi
                log.append(e)
                pos["points"] = pts
                pos["bar"] = bar
                pos["off"] = off
        out["log"] = log
        # decisions = yalnız GERÇEK analiz edilen taş-hamleleri (küp/no-move artık pos taşıyor;
        # sayıma girmesinler -> "no-moves-extracted" ok kontrolü ve özet bozulmasın).
        out["decisions"] = len([e for e in log if e.get("pos") and not e.get("cube")
                                and e.get("notation") != "(no move)"])
        out["ok"] = out["decisions"] > 0
        if not out["ok"]:
            out["error"] = "no-moves-extracted"
    except Exception as e:
        out["error"] = str(e)
    return out


def _matchluck(mat_text=None, selftest=False, points_match=1):
    """.mat maçının gnubg NATIVE luck'ını (per-oyuncu MWC% + EMG) döndürür — Tavlai Luck V1 kaynağı.
    mat_text verilmezse (selftest) gnubg kendi maçını oynar+export eder+reimport eder -> import+
    analyse+parse hattını tek çağrıda kanıtlar. Üretimde backend gerçek .mat gönderir."""
    out = {"import_cmd": None, "luck": None}
    tmp = "/tmp/tavlai_luck.mat"
    try:
        if selftest or not mat_text:
            steps = []
            out["selftest_plays"] = _play_auto_match(int(points_match), steps)
            try:
                gnubg.command("export match mat " + tmp)
                with open(tmp, "r") as f:
                    mat_text = f.read()
                out["selftest_mat_head"] = mat_text[:400]
            except Exception as e:
                out["export_err"] = str(e)
                return out
        # Temiz .mat'i diske yaz + import et (birkaç komut varyantı dene).
        with open(tmp, "w") as f:
            f.write(mat_text)
        imported = False
        last_err = None
        for cmd in ("import mat " + tmp, "load match " + tmp):
            try:
                gnubg.command("new match 1")  # önceki maçı temizle
            except Exception:
                pass
            try:
                gnubg.command(cmd)
                imported = True
                out["import_cmd"] = cmd
                break
            except Exception as e:
                last_err = str(e)
        if not imported:
            out["import_err"] = last_err
            return out
        try:
            gnubg.command("set analysis luck on")
        except Exception:
            pass
        gnubg.command("analyse match")
        stats = _capture_command("show statistics match")
        out["luck"] = _parse_luck_stats(stats)
        out["statistics_match"] = stats
    except Exception as e:
        out["error"] = str(e)
    return out


def _lucktest(points_match=1):
    """TEŞHİS (üretim değil): gnubg'nin NATIVE 'luck' (şans) çıktısını ölçmek için. İki gnubg botu
    kısa bir maç oynar; 'analyse match' çalışır; sonra HEM insan-okur 'show statistics match' metni
    (luck rate + ÖLÇEK/BİRİM burada görünür) HEM de (varsa) yapısal gnubg.match() per-move luck
    alanları dökülür. Amaç: luck ölçeği/normalizasyonu/ply/işaret'i TAHMİN ETMEDEN doğrulamak."""
    out = {"version": None, "steps": []}

    def _cmd(c):
        try:
            gnubg.command(c)
            out["steps"].append({"cmd": c, "ok": True})
        except Exception as e:
            out["steps"].append({"cmd": c, "ok": False, "err": str(e)})

    try:
        out["version"] = gnubg.command("show version")
    except Exception:
        pass
    # İki gnubg botu; 0-ply (hızlı, luck için tipik). Otomatik zar; oyunları elle ilerlet.
    _cmd("set player 0 gnubg")
    _cmd("set player 1 gnubg")
    _cmd("set player 0 chequer evaluation plies 0")
    _cmd("set player 1 chequer evaluation plies 0")
    _cmd("set analysis luck on")
    _cmd("set analysis moves on")
    _cmd("set automatic roll on")
    _cmd("set automatic game off")
    _cmd("new match %d" % int(points_match))
    plays = 0
    for _ in range(4000):
        try:
            gnubg.command("play")   # sıradaki gnubg oyuncusu için oto roll+move
            plays += 1
        except Exception:
            try:
                gnubg.command("new game")  # oyun bitti -> sonraki oyun
            except Exception:
                break                       # maç bitti -> dur
    out["plays"] = plays
    # Luck eval AYRI mı? (rapor: hangi ply/eval luck için kullanılıyor)
    out["show_analysis"] = _capture_command("show analysis")
    _cmd("analyse match")
    # KRİTİK KANIT: luck rate + ölçek + normalizasyon burada (EMG/MWC, per-move mi, işaret).
    out["statistics_match"] = _capture_command("show statistics match")
    # Yapısal per-move luck (varsa) — native alan adları + ham değerler.
    try:
        m = gnubg.match(1)  # analiz dahil
        out["match_struct_type"] = str(type(m))
        if isinstance(m, dict):
            out["match_struct_keys"] = list(m.keys())
        sample = []
        games = m.get("games") if isinstance(m, dict) else None
        if games:
            first = games[0]
            moves = None
            if isinstance(first, dict):
                moves = first.get("game") or first.get("moves") or first.get("analysis")
            if isinstance(moves, list):
                for mv in moves[:10]:
                    if isinstance(mv, dict):
                        sample.append({k: _safe(mv.get(k)) for k in mv.keys()
                                       if ("luck" in str(k).lower()) or k in ("player", "action", "type", "dice", "move")})
        out["luck_move_sample"] = sample
    except Exception as e:
        out["match_struct_err"] = str(e)
    return out


def _selfplay(max_plies=400, white_error=0.35, plies=1):
    """Iki bot (gnubg) bir oyun oynar. Beyaz, white_error olasilikla en iyi OLMAYAN adayi oynar ->
    beyazin PR'i sifir olmaz (orchestrator pipeline testi). BIZIM log formatinda karar listesi doner."""
    pos = _initial_pos()
    log = []
    winner = None
    stuck = None
    dances = 0
    for _ in range(max_plies):
        turn = pos["turn"]
        d1 = _random.randint(1, 6)
        d2 = _random.randint(1, 6)
        cand = None
        gid = None
        h = None
        err = None
        try:
            gid = structured_to_gnubgid({"points": pos["points"], "bar": pos["bar"],
                                         "turn": turn, "dice": [d1, d2], "matchLength": 0})
            gnubg.setgnubgid(gid)
            _set_plies(plies)
            h = gnubg.hint()
            cand = h.get("hint") if isinstance(h, dict) else None
        except Exception as e:
            err = str(e)
            cand = None
        if not cand:
            if stuck is None:  # ilk takilmayi yakala (dance mi hata mi + pozisyon)
                stuck = {"turn": turn, "dice": [d1, d2], "gnubgid": gid, "err": err,
                         "raw_hint": _safe(h), "points": list(pos["points"]),
                         "bar": dict(pos["bar"]), "off": dict(pos["off"])}
            dances += 1
            if dances > 20:  # gercekten takildi -> bosuna 400 donme
                break
            pos["turn"] = "black" if turn == "white" else "white"  # dance -> sira gecer
            continue
        dances = 0
        chosen = cand[0]
        if turn == "white" and len(cand) > 1 and _random.random() < white_error:
            chosen = cand[_random.randint(1, len(cand) - 1)]
        steps = _parse_gnubg_move_to_steps(turn, chosen.get("move", ""))
        log.append({
            "player": turn,
            "pos": {"points": list(pos["points"]), "bar": dict(pos["bar"]),
                    "off": dict(pos["off"]), "turn": turn},
            "dice": [d1, d2],
            "playedSteps": steps,
            "move": chosen.get("move"),
        })
        pts, bar = _apply_our_steps(pos["points"], pos["bar"], steps, turn)
        pos["points"] = pts
        pos["bar"] = bar
        pos["off"][turn] += sum(1 for s in steps if s.get("to") == "off")
        # DENETIM: her tarafta tam 15 tas olmali (points+bar+off). Bozulursa dur + hangi hamle bildir.
        wtot = sum(x for x in pts if x > 0) + bar["white"] + pos["off"]["white"]
        btot = sum(-x for x in pts if x < 0) + bar["black"] + pos["off"]["black"]
        if wtot != 15 or btot != 15:
            return {"log": log, "winner": None, "decisions": len(log), "invalid": {
                "move": chosen.get("move"), "turn": turn, "steps": steps, "dice": [d1, d2],
                "wtot": wtot, "btot": btot, "points": list(pts),
                "bar": dict(bar), "off": dict(pos["off"])}}
        if pos["off"][turn] >= 15:
            winner = turn
            break
        pos["turn"] = "black" if turn == "white" else "white"
    return {"log": log, "winner": winner, "decisions": len(log), "stuck": stuck}


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
            if self.path == "/selfplay":
                return self._send(200, _selfplay(
                    white_error=float(data.get("white_error", 0.35)),
                    plies=int(data.get("plies", 1))))
            if self.path == "/cubetest":
                if not data.get("points"):
                    return self._send(400, {"error": "points gerekli"})
                return self._send(200, _cubetest(data))
            if self.path == "/rollouttest":
                if not data.get("points"):
                    return self._send(400, {"error": "points gerekli"})
                return self._send(200, _rollouttest(data, int(data.get("trials", 36))))
            if self.path == "/lucktest":
                return self._send(200, _lucktest(int(data.get("points_match", 1))))
            if self.path == "/matchluck":
                return self._send(200, _matchluck(
                    mat_text=data.get("mat"),
                    selftest=bool(data.get("selftest", False)),
                    points_match=int(data.get("points_match", 1))))
            if self.path == "/analyzematch":
                if not data.get("mat"):
                    return self._send(400, {"error": "mat gerekli (.mat metni)"})
                return self._send(200, _analyzematch(
                    mat_text=data.get("mat"),
                    plies=int(data.get("plies", 2))))
            if self.path == "/reviewmatch":
                if not data.get("mat"):
                    return self._send(400, {"error": "mat gerekli (.mat metni)"})
                return self._send(200, _reviewmatch(
                    mat_text=data.get("mat"),
                    plies=int(data.get("plies", 2))))
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
