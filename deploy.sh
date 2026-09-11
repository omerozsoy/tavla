#!/bin/sh
# Plesk "Additional deployment actions" tarafindan git pull sonrasi calistirilir.
# Frontend derlemesi (backend/public/assets) repoya commit'lendigi icin sunucuda
# build GEREKMEZ; sadece Laravel cache temizlenir ve migration'lar uygulanir.
set -e

PHP=/opt/plesk/php/8.2/bin/php
cd "$(dirname "$0")/backend"

# ÖNEMLI: vendor/ git'e dahil DEGIL. Filament (ve diger paketler) sunucuda composer
# install ile kurulmali. Bu adim basarisiz olursa (composer PATH'te yoksa) Plesk
# "Composer" sekmesinden ELLE Install calistir; aksi halde uygulama Filament siniflarini
# bulamaz ve site acilmaz.
if command -v composer >/dev/null 2>&1; then
  composer install --no-dev --optimize-autoloader --no-interaction
elif [ -f composer.phar ]; then
  $PHP composer.phar install --no-dev --optimize-autoloader --no-interaction
else
  echo "UYARI: composer bulunamadi -> Plesk 'Composer' sekmesinden Install calistir!"
fi

# Filament statik varliklarini (css/js) public'e yayinla
$PHP artisan filament:assets || echo "UYARI: filament:assets atlandi"

# DIKKAT: migrate --force geri alinamaz. Kritik surumlerde ONCE DB yedegi al
# (Plesk > Databases > Export, ya da mysqldump). set -e sayesinde migrate patlarsa
# script burada durur; ama yarim uygulanan migration'i GERI ALMAK elle yapilir.
$PHP artisan migrate --force

# Istatistik verisi (idempotent; islenmisleri atlar -> ilk deploy'dan sonra ucuz):
#  - error-journal:backfill -> decision_analyses (Medyan Hata Orani per-karar + Zar Ortalamalari)
#  - stats:backfill-wxp      -> gecmis maclardan WXP toplamlari
$PHP artisan error-journal:backfill || echo "UYARI: error-journal:backfill atlandi."
$PHP artisan stats:backfill-wxp || echo "UYARI: stats:backfill-wxp atlandi."

$PHP artisan optimize:clear

# --- OPcache / PHP-FPM tazeleme ------------------------------------------------
# SORUN: PHP-FPM ayri (uzun omurlu) surectir; CLI'dan opcache_reset() FPM'in
# cache'ini ETKILEMEZ. optimize:clear yalniz Laravel cache'ini temizler. Degisen
# PHP (or. Filament form siniflari) canlida gorunmuyorsa sebep genelde budur.
# Best-effort: deploy kullanicisi yetkiliyse FPM'i reload eder; degilse SESSIZCE
# gecer -> o durumda Plesk UI'dan (Domain > PHP > Restart) elle yenile.
for SVC in plesk-php8.2-fpm plesk-php82-fpm php8.2-fpm php-fpm; do
  if sudo -n systemctl reload "$SVC" 2>/dev/null; then
    echo "OPcache: $SVC reload edildi."
    break
  fi
done
# cachetool varsa (yetkiye gerek yok, FPM socket uzerinden) opcache'i sifirla.
# Socket adi Plesk/dagitim arasinda degisebilir -> yaygin yollari sirayla dene,
# ilki tutunca dur. (cachetool.phar repoda commit'li; PHP 8.2+ gerekir.)
if [ -f cachetool.phar ]; then
  CT_OK=0
  for SOCK in \
    /var/run/plesk-php82-fpm.sock \
    /run/plesk-php82-fpm.sock \
    /var/run/php-fpm/plesk-php82-fpm.sock \
    /run/php-fpm/plesk-php82-fpm.sock \
    /var/run/php/php8.2-fpm.sock; do
    if [ -S "$SOCK" ] && $PHP cachetool.phar opcache:reset --fcgi="$SOCK" 2>/dev/null; then
      echo "OPcache: cachetool ile sifirlandi ($SOCK)."
      CT_OK=1
      break
    fi
  done
  [ "$CT_OK" = 1 ] || echo "UYARI: cachetool opcache:reset socket bulamadi -> gerekirse Plesk'ten FPM restart."
fi
# -----------------------------------------------------------------------------

# Haberleri commit'li JSON'dan ice aktar (offline; sunucudan internet gerekmez).
# Gorseller de commit'li (public/news) -> tekrar indirme yok. Hata olsa deploy patlamasin.
$PHP artisan news:import --file=database/data/news.json || echo "UYARI: news:import atlandi."
$PHP artisan magazine:import --file=database/data/magazine.json || echo "UYARI: magazine:import atlandi."

# --- gnubg analiz motoru + queue worker: kod degisince YENIDEN BASLAT --------------
# SORUN: gnubg motoru /opt/gnubg-service/gnubg_service.py'yi (ayri kopya) uzun-omurlu
# systemd servisinde calistirir; queue worker de eski PHP kodunu tutar. Deploy'da bunlar
# YENILENMEZSE "analiz motoru guncel degil" olur. Best-effort: sudo -n yetkisi varsa
# gnubg_service.py'yi senkronla + servisi restart et; yoksa SESSIZCE gecip elle komutu yaz.
# (cwd = backend/ -> repo koku = ..)
if [ -f ../gnubg-service/gnubg_service.py ]; then
  sudo -n cp ../gnubg-service/gnubg_service.py /opt/gnubg-service/gnubg_service.py 2>/dev/null \
    && echo "gnubg: gnubg_service.py /opt/gnubg-service'e senkronlandi."
  if sudo -n systemctl restart gnubg-analysis.service 2>/dev/null; then
    echo "gnubg: gnubg-analysis servisi yeniden baslatildi."
  else
    echo "UYARI: gnubg-analysis restart edilemedi -> ELLE: sudo systemctl restart gnubg-analysis.service"
  fi
fi
# Queue worker (gnubg PR shadow) eski kodu calistirir -> her deploy'da yenile (bkz deploy/README).
if sudo -n systemctl restart tavla-queue 2>/dev/null; then
  echo "tavla-queue yeniden baslatildi."
else
  $PHP artisan queue:restart >/dev/null 2>&1 \
    && echo "queue:restart sinyali gonderildi (worker sonraki job'da yeni kodu alir)." \
    || echo "UYARI: tavla-queue yenilenemedi -> ELLE: sudo systemctl restart tavla-queue"
fi
# -----------------------------------------------------------------------------

echo "Deploy tamam: migrate + cache + haber importu + gnubg/queue restart."
