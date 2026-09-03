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
if [ -f cachetool.phar ]; then
  $PHP cachetool.phar opcache:reset --fcgi=/var/run/plesk-php82-fpm.sock 2>/dev/null \
    && echo "OPcache: cachetool ile sifirlandi." || true
fi
# -----------------------------------------------------------------------------

# Haberleri commit'li JSON'dan ice aktar (offline; sunucudan internet gerekmez).
# Gorseller de commit'li (public/news) -> tekrar indirme yok. Hata olsa deploy patlamasin.
$PHP artisan news:import --file=database/data/news.json || echo "UYARI: news:import atlandi."
$PHP artisan magazine:import --file=database/data/magazine.json || echo "UYARI: magazine:import atlandi."

echo "Deploy tamam: migrate + cache + haber importu."
