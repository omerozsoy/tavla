#!/usr/bin/env bash
# Adil Zar gist senkronu — https://gist.github.com/omerozsoy/bdebe5a96c899b56c1a75577cc81ade3
#
# "Kaydetme adimi" bir daha kacmasin diye: canli FairDiceService.php + bu klasordeki
# README.md + verify.php dosyalarini gist'e basar. FairDiceService.php'nin (ya da zar
# algoritmasinin) v2 gibi degismesinden SONRA bir kez calistir.
#
#   bash scripts/adil-zar-gist/sync.sh
#
# Gereksinim: gh (gist scope'lu) + php. verify.php'nin vektorleri hala sunucuyla birebir
# mi diye ONCE self-test kosar; gecmezse HICBIR SEY push etmez.
#
# NOT: algoritma degisirse verify.php icindeki gomulu ground-truth vektorlerini ve bu
# klasordeki FairDiceService.php kopyasini (gist README'si bunlardan bahseder) guncelle;
# ayni vektorler src/engine/fairDice.test.ts ve backend testlerinde de var.
set -euo pipefail

GIST_ID=bdebe5a96c899b56c1a75577cc81ade3
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="$HERE/../../backend/app/Services/FairDiceService.php"

[ -f "$SERVICE" ] || { echo "FairDiceService.php bulunamadi: $SERVICE" >&2; exit 1; }

echo "1) verify.php self-test (sunucuyla birebir mi?)"
php "$HERE/verify.php" --self-test

echo
echo "2) Gist'e push"
gh gist edit "$GIST_ID" --filename FairDiceService.php "$SERVICE"
gh gist edit "$GIST_ID" --filename README.md          "$HERE/README.md"
gh gist edit "$GIST_ID" --filename verify.php         "$HERE/verify.php"

echo
echo "Senkron tamam -> https://gist.github.com/omerozsoy/$GIST_ID"
