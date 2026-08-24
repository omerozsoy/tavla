#!/bin/sh
# Plesk "Additional deployment actions" tarafindan git pull sonrasi calistirilir.
# Frontend derlemesi (backend/public/assets) repoya commit'lendigi icin sunucuda
# build GEREKMEZ; sadece Laravel cache temizlenir ve migration'lar uygulanir.
set -e

PHP=/opt/plesk/php/8.2/bin/php
cd "$(dirname "$0")/backend"

$PHP artisan migrate --force
$PHP artisan optimize:clear

# Haberleri TavlaTv blog RSS'inden ice aktar (gorseller commit'li -> tekrar indirmez).
# Feed gecici erisilemezse deploy patlamasin diye hatayi yut (|| true).
$PHP artisan news:import || echo "UYARI: news:import basarisiz (feed erisimi?), atlandi."

echo "Deploy tamam: migrate + cache + haber importu."
