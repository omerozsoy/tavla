#!/usr/bin/env bash
# Adil Zar gist senkronu — https://gist.github.com/omerozsoy/bdebe5a96c899b56c1a75577cc81ade3
#
# "Kaydetme adimi" bir daha kacmasin diye: canli FairDiceService.php + bu klasordeki
# README.md + verify.php dosyalarini gist'e basar. Zar algoritmasi (v2 gibi) degisince calistir:
#
#   bash scripts/adil-zar-gist/sync.sh
#
# Gereksinim: gh (gist scope'lu) + php.
# Push ETMEDEN ONCE iki kapi:
#   1) verify.php --self-test        (gomulu vektorler tutarli mi)
#   2) verify.php --compare-live      (verify.php CANLI FairDiceService.php ile BIREBIR mi)
# Ikisinden biri gecmezse HICBIR SEY push edilmez.
#
# NOT: algoritma degisirse verify.php icindeki gomulu ground-truth vektorlerini guncelle;
# ayni vektorler src/engine/fairDice.test.ts ve backend testlerinde de var.
set -euo pipefail

GIST_ID=bdebe5a96c899b56c1a75577cc81ade3
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SERVICE="$REPO/backend/app/Services/FairDiceService.php"

[ -f "$SERVICE" ] || { echo "FairDiceService.php bulunamadi: $SERVICE" >&2; exit 1; }

echo "1) verify.php self-test"
php "$HERE/verify.php" --self-test >/dev/null && echo "   OK"

echo "2) verify.php <-> CANLI FairDiceService.php"
php "$HERE/verify.php" --compare-live "$SERVICE"

# README eslestirme damgasi: tarih + servis dosyasinin son commit'i
SVC_SHA="$(git -C "$REPO" log -1 --format=%h -- backend/app/Services/FairDiceService.php 2>/dev/null || echo unknown)"
STAMP="$(date +%Y-%m-%d) (FairDiceService.php @ ${SVC_SHA})"
sed -i -E "s|^> _Son eşitleme / Last synced:.*|> _Son eşitleme / Last synced: ${STAMP}_|" "$HERE/README.md"
echo "3) README damgasi: ${STAMP}"

echo "4) Gist'e push"
gh gist edit "$GIST_ID" --filename FairDiceService.php "$SERVICE"
gh gist edit "$GIST_ID" --filename README.md          "$HERE/README.md"
gh gist edit "$GIST_ID" --filename verify.php         "$HERE/verify.php"

echo
echo "Senkron tamam -> https://gist.github.com/omerozsoy/$GIST_ID"
