# Tavla queue worker (gnubg PR shadow)

Maç bitince `AnalyzeMatchPrJob` **database kuyruğuna** düşer; gnubg PR'ını arka planda hesaplayıp
`match_results.gnubg_*` kolonlarına yazar (gösterilen/otoriter PR'a **dokunmaz**). Bu işi **kalıcı
bir queue worker** çalıştırır. `GNUBG_PR_MODE=off` iken hiçbir şey dispatch edilmez (varsayılan).

## Kurulum (AlmaLinux 8 + Plesk, root)

### 1) backend/.env
```
GNUBG_PR_MODE=shadow
DB_QUEUE_RETRY_AFTER=700     # job timeout (600) > retry_after olmalı -> çift işleme yok
# GNUBG_URL / GNUBG_SECRET zaten ayarlı olmalı (gnubg servisi)
```
Sonra config cache temizle (Laravel Toolkit → `config:clear`, veya SSH).

### 2) Migration (yeni gnubg_* kolonları)
Laravel Toolkit → Artisan → `migrate`  (veya SSH: `php artisan migrate`)

### 3) Worker systemd servisi
```
# vhost kullanıcısını bul:
stat -c '%U' /var/www/vhosts/tavlatv.com/httpdocs

# unit'i kopyala, User= satırını o kullanıcıyla düzenle:
cp deploy/tavla-queue.service /etc/systemd/system/tavla-queue.service
nano /etc/systemd/system/tavla-queue.service   # User=CHANGE_ME_VHOST_USER -> gerçek kullanıcı

systemctl daemon-reload
systemctl enable --now tavla-queue
systemctl status tavla-queue --no-pager
```

### 4) Test
Bir maç oyna → birkaç saniye sonra:
```
# gnubg_pr dolmuş mu? (Laravel Toolkit tinker veya SQL)
# match_results son satırda gnubg_pr / gnubg_checker_pr / gnubg_cube_pr dolu olmalı.
# Log: storage/logs/laravel.log içinde "gnubg PR shadow" satırı (client_pr vs gnubg_pr).
```

## Deploy sonrası
Backend kodu değişince worker ESKİ kodu çalıştırmaya devam eder → `deploy.sh` bunu otomatik
`systemctl restart tavla-queue` (sudo yetkisi varsa) veya `queue:restart` ile yeniler.

**KALICI EMNİYET (unit'e `--max-time=3600` eklendi):** deploy restart'ı bir kez kaçsa bile worker
saatte bir KENDİNİ sonlandırır ve `Restart=always` onu TAZE kodla geri getirir → stale kod en fazla
~1 saat yaşar, sonra otomatik düzelir. **Bu değişikliği bir kez canlıya almak için:**
```
cp deploy/tavla-queue.service /etc/systemd/system/tavla-queue.service
nano /etc/systemd/system/tavla-queue.service   # User= satırını KORU (gerçek vhost kullanıcısı)
systemctl daemon-reload
systemctl restart tavla-queue
systemctl status tavla-queue --no-pager        # ExecStart'ta --max-time=3600 görünmeli
```

---

# Tavla Reverb (gerçek-zamanlı oda push — polling yükü fix, "A" adımı)

Turnuvada her istemci odayı 1.2sn'de bir `/show`'a soruyordu (FPM/DB yükü). Reverb WebSocket
sunucusu ile oyun aksiyonları (hamle/zar/küp/pes) istemcilere **anında push** edilir; poll yalnız
**yavaş yedek** olarak kalır (socket düşerse oyun takılmaz). Backend tarafı hazır: `App\Events\
RoomUpdated` (public `room.{code}` kanalı) + `RoomController::broadcastRoom()`.

**DORMANT:** `BROADCAST_CONNECTION` ayarlı değilken (varsayılan `null`) hiçbir şey yayınlanmaz.
Aşağıdaki adımlar tamamlanıp **doğrulanana kadar** `BROADCAST_CONNECTION`'ı değiştirme → canlı
hiç etkilenmez.

## 1) backend/.env
```
# reverb uygulama kimlikleri (php artisan reverb:install bunları üretir; yoksa elle rastgele ata)
REVERB_APP_ID=...
REVERB_APP_KEY=...
REVERB_APP_SECRET=...
REVERB_HOST=127.0.0.1        # Reverb YALNIZ localhost dinler
REVERB_PORT=8080
REVERB_SCHEME=http

# frontend build (Vite) — istemci wss ile 443'ten nginx proxy'ye bağlanır:
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST=tavlatv.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https

# !!! EN SON, her şey doğrulanınca aç (önce 'null'/ayarsız bırak):
# BROADCAST_CONNECTION=reverb
```
`php artisan reverb:install` yoksa: 3 değeri elle ata (ID sayı, KEY/SECRET rastgele 20+ hex).

## 2) systemd servisi (tavla-queue ile aynı kullanıcı)
```
stat -c '%U' /var/www/vhosts/tavlatv.com/httpdocs            # vhost kullanıcısı
cp deploy/tavla-reverb.service /etc/systemd/system/tavla-reverb.service
nano /etc/systemd/system/tavla-reverb.service                # User=CHANGE_ME_VHOST_USER -> gerçek
systemctl daemon-reload
systemctl enable --now tavla-reverb
systemctl status tavla-reverb --no-pager                     # :8080 dinliyor olmalı
ss -ltnp | grep 8080                                         # 127.0.0.1:8080 LISTEN
```

## 3) nginx wss reverse-proxy (Plesk → Websites & Domains → Apache & nginx Settings → **Additional nginx directives**)
Plesk'te nginx ÖN katmandır (443'ü karşılar) ve WebSocket upgrade'i en temiz o yapar. `/app`
yolunu doğrudan Reverb'e geçir (Apache'yi baypas eder):
```nginx
location /app {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```
Not: `/app` yolu SPA'da KULLANILMIYOR (çakışma yok). Laravel'in Reverb'e yayını (`/apps/{id}/
events`) 127.0.0.1:8080'e DOĞRUDAN gider (nginx'e gerek yok). Sadece istemci WS'i (`/app`) proxy'lenir.

## 4) Doğrula → SONRA aç
```
# WS el sıkışması (426/101 beklenir, timeout DEĞİL):
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://tavlatv.com/app/test 2>&1 | head
```
El sıkışma çalışıyorsa `.env`'de `BROADCAST_CONNECTION=reverb` yap + config cache temizle + FPM reload.
Sorun olursa `BROADCAST_CONNECTION`'ı geri `null` yap → anında eski (poll) davranışa dön (sıfır risk).

## Deploy sonrası
`deploy.sh` kod değişince `tavla-reverb`'ü otomatik `systemctl restart` eder (uzun-ömürlü PHP daemon
eski Event kodunu tutmasın). Kurulu değilse sessizce atlar.

---

## Notlar
- Worker düşerse `Restart=always` kaldırır. İzleme istersen validator:watch benzeri eklenebilir.
- **Şans (luck) işi artık asla `failed_jobs`'a düşmez:** `AnalyzeMatchLuckJob` her hatayı yutup
  satırı `TAVLAI_LUCK_UNAVAILABLE` işaretler (luck kritik değil). "Başarısız İşler" alarmı bir daha
  luck yüzünden çalmaz; gerçekten önemli olan PR işi (`AnalyzeMatchPrJob`, tries=3) ayrı kalır.
- `authoritative` moduna geçmeden shadow'da client vs gnubg PR farkını gözlemle (log/kolon).
