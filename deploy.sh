#!/bin/sh
# Plesk "Additional deployment actions" tarafindan git pull sonrasi calistirilir.
# Frontend derlemesi (backend/public/assets) repoya commit'lendigi icin sunucuda
# build GEREKMEZ; sadece Laravel cache temizlenir ve migration'lar uygulanir.
set -e

PHP=/opt/plesk/php/8.2/bin/php
cd "$(dirname "$0")/backend"

$PHP artisan migrate --force
$PHP artisan optimize:clear

echo "Deploy tamam: migrate + cache temizlendi."
