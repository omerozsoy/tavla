# GNU Backgammon Analiz Servisi (tavlai — ana motor)

gnubg ağır bir C programı; her istekte yeniden başlatmak pahalı. Bu servis gnubg'yi **açık tutar**
(gnubg'nin gömülü Python'unda çalışan küçük bir HTTP servisi) ve analizi hızlı sunar — validator
mikroservisinin gnubg karşılığı. Çok-motorlu analiz mimarisinde **birincil (deep) motorun evi**.

## Uçlar
- `GET /health` → `{ok:true, service:"gnubg"}` (secret'siz).
- `POST /hint` `{gnubgid, plies?}` → gnubg.hint() yapısal sonucu (aday hamleler + cubeful equity +
  eqdiff + 5'li olasılık). `gnubgid` = gnubg'nin `posID:matchID` kanonik kodu (konum + küp/skor/sıra/zar).
- `POST /evaluate` `{gnubgid}` → pozisyonun ham olasılık değerlendirmesi.

## Güvenlik
- **Yalnız 127.0.0.1** + `GNUBG_SECRET` başlığı (`x-gnubg-secret`). ASLA halka açık portta çalıştırma.
- Tek-thread: gnubg'nin geçerli konumu GLOBAL durum → istekler SIRAYLA işlenir (yarış yok).

## Kurulum (AlmaLinux 8 + root, Plesk sunucu)
```
# 1) Dosyayı sunucuya koy
mkdir -p /opt/gnubg-service
# gnubg_service.py'yi /opt/gnubg-service/ altına kopyala (repo'dan)

# 2) systemd servisi (kalıcı + otomatik-restart = self-healing)
cp gnubg-analysis.service /etc/systemd/system/gnubg-analysis.service
# GNUBG_SECRET'i UZUN-RASTGELE bir değerle düzenle:
nano /etc/systemd/system/gnubg-analysis.service

systemctl daemon-reload
systemctl enable --now gnubg-analysis
systemctl status gnubg-analysis --no-pager
```

## Test
```
# Sağlık
curl -s http://127.0.0.1:8092/health

# Bilinen bir pozisyonda hint (gnubgid = posID:matchID)
curl -s -X POST http://127.0.0.1:8092/hint \
  -H "x-gnubg-secret: <SECRET>" -H "content-type: application/json" \
  -d '{"gnubgid":"4HPwATCwZ/ABMA:MIEFAAAAAAAA"}' | head -c 800
```
`/hint` aday hamleleri equity'leriyle döndürüyorsa servis hazır.

## Backend bağlama (sonraki adım)
`backend/.env`: `GNUBG_URL=http://127.0.0.1:8092`, `GNUBG_SECRET=<aynı>`.
Orkestratör (deep analiz) hem validator (wildbg) hem bu servisi (gnubg) çağırır; disagreement +
selective rollout mantığı orada. PR **final otoriter** sonuçtan hesaplanır (bkz `src/analysis/pr.ts`).

## Güncelleme (kod değişince canlıya alma)
`gnubg_service.py` VEYA `.service` değişince canlıda TEK SEFER:
```
cp gnubg-service/gnubg_service.py /opt/gnubg-service/gnubg_service.py
cp gnubg-service/gnubg-analysis.service /etc/systemd/system/gnubg-analysis.service  # .service değiştiyse
systemctl daemon-reload   # yalnız .service değiştiyse
systemctl restart gnubg-analysis
curl -s http://127.0.0.1:8092/health   # {ok:true} beklenir
```
Plesk `deploy.sh` bunu OTOMATİK yapmaz (repo'daki dosya ≠ /opt'taki çalışan dosya) — elle kopyala.

## "gnubg DÜŞTÜ" alarmı hâlâ geliyorsa (teşhis)
Servis çoğu zaman ÇÖKMÜYOR; **meşgul** olduğu için tek-thread'de /health'e cevap veremiyordu ve
izleyici (services:watch, 5sn /health probe) bunu "düştü" sanıp gereksiz restart ediyordu. FIX
(2026-09-25): HTTP sunucusu thread'li (ThreadingMixIn) + gnubg erişimi `_GNUBG_LOCK` ile serileşir
+ /health gnubg'siz/kilitsiz anında cevaplar. Böylece uzun analiz (/reviewmatch 600s) sürerken bile
/health yeşil. Ayrıca `.service`'te `StartLimitIntervalSec=0` (kısır döngüde systemd pes etmez).
- Gerçekten düştüyse: `journalctl -u gnubg-analysis -n 100 --no-pager` (çökme sebebi: OOM? symlink?).
- `services:watch`'ın OTOMATİK restart'ı için PHP kullanıcısına sudo gerekir (yoksa yalnız alarm
  gelir, restart edemez). Drop-in: `/etc/sudoers.d/tavla`:
  `plesk-php-user ALL=(root) NOPASSWD: /usr/bin/systemctl restart gnubg-analysis, /usr/bin/systemctl restart tavla-queue`
  (systemd `Restart=always` ZATEN sudosuz çalışır — sudo yalnız wedge/meşgul durumunu kırmak içindi;
  thread fix'i o durumu kökten çözdüğü için sudo artık kritik değil.)

## AĞIR analiz instance'ı (Level 11/12 concurrency — CANLI botu bloklamamak için)

gnubg TEK process + global kilit ile çalışır: uzun bir analiz (Mat Analiz `/reviewmatch` 600s,
`/analyzematch`, `/matchluck`) kilidi tutarken **canlı bot `/analyze` çağrıları kuyrukta bekler**.
Level 11/12 (3-ply/4-ply) daha uzun sürdüğü için bu darboğaz büyür. Çözüm: **iki ayrı instance**.

```
# 1) Canlı bot instance (mevcut) — port 8092
systemctl status gnubg-analysis        # ExecStart ... GNUBG_PORT=8092

# 2) Ağır analiz instance — port 8093 (AYNI kod, AYNI secret)
cp gnubg-service/gnubg-analysis-heavy.service /etc/systemd/system/gnubg-analysis-heavy.service
nano /etc/systemd/system/gnubg-analysis-heavy.service   # GNUBG_SECRET'i canlı ile AYNI yap
systemctl daemon-reload
systemctl enable --now gnubg-analysis-heavy
curl -s http://127.0.0.1:8093/health   # {ok:true}

# 3) backend/.env: ağır uçları 8093'e yönlendir (canlı bot 8092'de kalır)
GNUBG_HEAVY_URL=http://127.0.0.1:8093
# (config/gnubg.php `heavy_url` bunu okur; boşsa tek instance = geriye dönük uyum.)
```
Backend `heavy_url` boşken TEK instance kullanılır (davranış değişmez). 8093 açıldığında
reviewmatch/analyzematch/matchluck/selfplay oraya, canlı bot `/analyze` 8092'de kalır → uzun analiz
canlı oyunu kilitleyemez. `/health` `peak_inflight`'ı izleyerek çok-süreçli havuz gerekip gerekmediği
ölçülebilir (GnuBgClient::healthInfo → admin "Servis Durumu").

## PR/bot FAILOVER — 4 instance ("bir daha boş PR yok")

`/analyze`'ı HEM PR (AnalysisOrchestrator) HEM canlı bot (BotMoveService) kullanır. `GnuBgClient::analyze()`
artık **failover**: `GNUBG_URL` + `GNUBG_URL_BACKUP` tabanlarını SIRAYLA dener, ilk 2xx'i döndürür.
Bir instance down/yavaş/restart olsa diğeri devreye girer → PR asla "—" kalmaz. Admin "Servis Durumu"
her instance'ı AYRI lamba gösterir + `services:watch` her birini ayrı izleyip **kendi birimiyle**
otomatik restart eder.

```
# 8092 (canlı bot) + 8093 (heavy) zaten var. 3. ve 4. instance'ı ekle:
cp gnubg-service/gnubg-analysis-3.service /etc/systemd/system/gnubg-analysis-3.service   # :8094
cp gnubg-service/gnubg-analysis-4.service /etc/systemd/system/gnubg-analysis-4.service   # :8095
nano /etc/systemd/system/gnubg-analysis-3.service   # GNUBG_SECRET'i diğerleriyle AYNI yap
nano /etc/systemd/system/gnubg-analysis-4.service   # GNUBG_SECRET'i diğerleriyle AYNI yap
systemctl daemon-reload
systemctl enable --now gnubg-analysis-3 gnubg-analysis-4
curl -s http://127.0.0.1:8094/health && curl -s http://127.0.0.1:8095/health   # {ok:true}

# backend/.env: PR/bot failover havuzu = 4 instance + panel/watch birim adları (SIRAYLA hizalı)
GNUBG_URL=http://127.0.0.1:8092
GNUBG_URL_BACKUP=http://127.0.0.1:8093,http://127.0.0.1:8094,http://127.0.0.1:8095
GNUBG_UNITS=gnubg-analysis,gnubg-analysis-heavy,gnubg-analysis-3,gnubg-analysis-4
# sonra: php artisan config:cache && systemctl reload php-fpm* && systemctl restart tavla-queue
```

`GNUBG_URL_BACKUP` boşsa TEK instance (eski davranış). `GNUBG_UNITS` bases sırasıyla hizalı olmalı
(panel "Yeniden Başlat" + services:watch doğru birimi hedeflesin). 4 instance → aynı anda 3'ü düşse
bile PR hesaplanır; watchdog + `Restart=always` düşeni saniyeler içinde ayağa kaldırır.

## Notlar
- **gnubgid üretimi:** backend `GameState` → gnubg `posID:matchID` çevirir (adapter işi). Test için
  gnubg'den okunmuş hazır id kullanılır.
- **Semantik:** gnubg **cubeful + match-aware** equity verir; wildbg **cubeless money**. Checker
  kıyası için gnubg'nin 5'li olasılığından kübsüz equity türet (elma-elma); küp + maç-skoru için
  gnubg'nin cubeful/MWC'sini kullan. Cubeful/cubeless KARIŞTIRMA.
- **Rollout:** ileride `/rollout` ucu (adaptive stopping) eklenecek — yalnız çekişmeli pozisyonlar için.
