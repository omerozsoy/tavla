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

## Notlar
- Worker düşerse `Restart=always` kaldırır. İzleme istersen validator:watch benzeri eklenebilir.
- **Şans (luck) işi artık asla `failed_jobs`'a düşmez:** `AnalyzeMatchLuckJob` her hatayı yutup
  satırı `TAVLAI_LUCK_UNAVAILABLE` işaretler (luck kritik değil). "Başarısız İşler" alarmı bir daha
  luck yüzünden çalmaz; gerçekten önemli olan PR işi (`AnalyzeMatchPrJob`, tries=3) ayrı kalır.
- `authoritative` moduna geçmeden shadow'da client vs gnubg PR farkını gözlemle (log/kolon).
