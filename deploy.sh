#!/bin/sh
# Plesk "Additional deployment actions" tarafindan git pull sonrasi calistirilir.
# Frontend derlemesi (backend/public/assets) repoya commit'lendigi icin sunucuda
# build GEREKMEZ; sadece Laravel cache temizlenir ve migration'lar uygulanir.
set -e

PHP=/opt/plesk/php/8.2/bin/php
cd "$(dirname "$0")/backend"

$PHP artisan migrate --force
$PHP artisan optimize:clear

# Haberleri commit'li JSON'dan ice aktar (offline; sunucudan internet gerekmez).
# Gorseller de commit'li (public/news) -> tekrar indirme yok. Hata olsa deploy patlamasin.
$PHP artisan news:import --file=database/data/news.json || echo "UYARI: news:import atlandi."
$PHP artisan magazine:import --file=database/data/magazine.json || echo "UYARI: magazine:import atlandi."

echo "Deploy tamam: migrate + cache + haber importu."
