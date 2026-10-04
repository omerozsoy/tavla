"""A-26 regresyon: her analiz isteği kendi geçici .mat dosyasını kullanmalı ve sonra silmeli.
Çalıştır: python3 gnubg-service/test_tmp_isolation.py  (gerçek gnubg gerekmez; sahte modül)."""
import os
import sys
import types

seen = []  # (path, içerik) — gnubg'nin import ettiği dosya


def _command(cmd):
    if cmd.startswith("import mat "):
        path = cmd[len("import mat "):]
        with open(path) as f:
            seen.append((path, f.read()))
        raise RuntimeError("stop-after-import")  # analiz akışının geri kalanına gerek yok


fake = types.ModuleType("gnubg")
fake.command = _command
sys.modules["gnubg"] = fake

src = open(os.path.join(os.path.dirname(__file__), "gnubg_service.py"), encoding="utf-8").read()
src = src.rsplit("\nmain()", 1)[0]  # sunucuyu başlatma
ns = {"__name__": "gnubg_service_test"}
exec(compile(src, "gnubg_service.py", "exec"), ns)

ns["_analyzematch"]("; [Site] A\n 1 point match\n", 0)
ns["_matchluck"]("; [Site] B\n 1 point match\n")

paths = [p for p, _ in seen]
assert len(paths) >= 2, paths
assert paths[0] != "/tmp/tavlai_analyze.mat" and paths[-1] != "/tmp/tavlai_luck.mat", paths
assert len(set(paths)) == len(paths), "her istek ayrı dosya kullanmalı: %r" % paths
assert "[Site] A" in seen[0][1] and "[Site] B" in seen[-1][1]
for p in paths:
    assert not os.path.exists(p), "geçici dosya silinmeli: " + p
print("OK", paths)
