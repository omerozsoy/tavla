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
$PHP artisan optimize:clear

# Haberleri commit'li JSON'dan ice aktar (offline; sunucudan internet gerekmez).
# Gorseller de commit'li (public/news) -> tekrar indirme yok. Hata olsa deploy patlamasin.
$PHP artisan news:import --file=database/data/news.json || echo "UYARI: news:import atlandi."
$PHP artisan magazine:import --file=database/data/magazine.json || echo "UYARI: magazine:import atlandi."

echo "Deploy tamam: migrate + cache + haber importu."
