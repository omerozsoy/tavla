#!/bin/sh
# Plesk "Additional deployment actions" tarafindan git pull sonrasi calistirilir.
# Frontend derlemesi (backend/public/assets) repoya commit'lendigi icin sunucuda
# build GEREKMEZ; sadece Laravel cache temizlenir ve migration'lar uygulanir.
#
# `set -e` KASITLI YOK: bu script bastan sona BEST-EFFORT (her servis restart / cache / import
# `|| echo` ile toleransli). `set -e` (ozellikle /bin/sh=dash'te) guard'li `&&` zincirleri ve
# `sudo -n` basarisizliklarinda script'i ERKEN non-zero bitiriyordu -> Plesk "additional deployment
# actions" adimini ⚠️ (uyari) gosteriyordu (cikis kodu != 0), oysa deploy aslinda basariliydi.
# Tek KRITIK komut `migrate --force`: asagida ACIKCA olumculdur (patlarsa exit 1 -> Plesk dogru
# sekilde uyarir). Diger her sey basarisiz olsa da deploy tamamlanir; sonda `exit 0` -> adim YESIL.

PHP=/opt/plesk/php/8.2/bin/php
cd "$(dirname "$0")/backend"

# ================== ESZAMANLI DEPLOY KILIDI (KOK ONLEM) ==================
# 2026-10-18: Plesk "Pull & Deploy" task'i AdditionalActionsStep'te asiliyken ELLE
# `sh deploy.sh` kosturuldu -> IKISI ayni anda bootstrap/cache/packages.php'ye yazdi ->
# dosya yarida truncate oldu ("array_merge(): Argument #2 must be array, int given" +
# "Target class [view] does not exist") -> site TAMAMEN 500; optimize:clear bile acilista
# patladigi icin kendini KURTARAMADI -> yuzlerce kullanici magdur. flock ile ayni anda TEK
# deploy calissin; ikincisi ilki bitene kadar BEKLER (atlamaz -> en guncel kod yine uygulanir).
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/tavla-deploy.lock
  flock -w 600 9 || { echo "HATA: 10dk icinde deploy kilidi alinamadi (baska deploy takildi mi?) -> cikiliyor."; exit 1; }
  echo "deploy kilidi alindi (eszamanli deploy engellendi)."
else
  echo "UYARI: flock yok -> eszamanli deploy korumasi atlandi (riskli; util-linux kur)."
fi

# YENİ Filament kaynakları (ör. "İletişim Talepleri") cache yüzünden panelde GÖRÜNMESİN
# diye component cache'ini deploy'un EN BAŞINDA KOŞULSUZ temizle. set -e ile ilerideki bir
# adım (composer/migrate) patlasa bile bu çalışmış olur; ayrıca dosyayı fiziksel sil ki
# optimize-clear herhangi bir sebeple no-op olsa dahi bayat liste kalmasın.
rm -rf bootstrap/cache/filament 2>/dev/null || true

# ================== .htaccess KALICI KORUMASI (önlem) ==================
# backend/public/.htaccess KRİTİK bloğu (CSP -> Google login; mod_rewrite -> /api routing;
# index.html no-cache -> chunk hataları) BİRDEN FAZLA KEZ yanlışlıkla 96->12 satıra budandı
# (eşzamanlı oturum public/ ile oynarken ezdi -> site patladı + "login olamıyorlar"). KÖK ÇÖZÜM:
# .htaccess'in TEK DOĞRU KAYNAĞI = deploy/htaccess.canonical. Her deploy'da public/'e ZORLA
# kopyalanır -> repoya bozuk .htaccess commit'lense bile CANLI DAİMA doğru olur. Canonical'ın
# kendisi kritik işaretleri taşımıyorsa (bozuksa) DOKUNMA (mevcut canlıyı riske atma).
CANON=../deploy/htaccess.canonical
if [ -f "$CANON" ] && grep -q "Content-Security-Policy" "$CANON" && grep -q "RewriteEngine" "$CANON"; then
  cp -f "$CANON" public/.htaccess && echo ".htaccess canonical'dan geri yuklendi (CSP + rewrite garanti)."
else
  echo "UYARI: deploy/htaccess.canonical eksik/bozuk -> public/.htaccess DOKUNULMADI."
fi

# ÖNEMLI: vendor/ git'e dahil DEGIL. Filament (ve diger paketler) sunucuda composer
# install ile kurulmali. Bu adim basarisiz olursa (composer PATH'te yoksa) Plesk
# "Composer" sekmesinden ELLE Install calistir; aksi halde uygulama Filament siniflarini
# bulamaz ve site acilmaz.
# NOT: `|| echo` ile TOLERANSLI -> composer install patlasa bile `set -e` scripti
# BURADA DURDURMASIN; asagidaki `migrate --force` HER ZAMAN calissin. (vendor/ sunucuda
# kalicidir; gecici bir composer hatasi DB semasinin kod ile ayrisip 500'lere -"table/column
# not found"- yol acmasindan cok daha az zararlidir.)
# HIZLANDIRMA: composer install her deploy'da ~30sn-2dk (optimize-autoloader classmap dump) alir,
# oysa bagimliliklar genelde DEGISMEZ. vendor/ sunucuda kalicidir -> composer.lock BYTE-AYNIysa
# vendor zaten dogru demektir; install'i atla. Marker = lock'un md5'i (storage/app/, deploy'lar
# arasi kalici). Lock degisince (ya da vendor/ yoksa, ya da md5sum yoksa) install KOSAR + marker
# yalniz BASARILI install'dan sonra yazilir (patlarsa sonraki deploy tekrar dener).
LOCK_HASH=$(md5sum composer.lock 2>/dev/null | awk '{print $1}')
LOCK_MARK=storage/app/.deploy-composer-lock
if [ -n "$LOCK_HASH" ] && [ -d vendor ] && [ "$(cat "$LOCK_MARK" 2>/dev/null)" = "$LOCK_HASH" ]; then
  echo "composer install atlandi (composer.lock degismedi; vendor/ guncel)."
else
  COMPOSER_OK=0
  if command -v composer >/dev/null 2>&1; then
    # 2>&1: composer TUM ciktisini (ilerleme, autoload, funding notu) stderr'e yazar; Plesk stderr
    # yazan adimi ⚠️ ile isaretler. stderr'i stdout'a yonlendir -> adim YESIL olur (cikti yine gorunur,
    # exit kodu korunur -> gercek composer hatasi yine `|| echo`e duser). migrate/cache stderr'i DOKUNULMAZ.
    composer install --no-dev --optimize-autoloader --no-interaction 2>&1 && COMPOSER_OK=1 || echo "UYARI: composer install patladi -> deploy migrate ile devam ediyor; gerekirse Plesk 'Composer' > Install."
  elif [ -f composer.phar ]; then
    $PHP composer.phar install --no-dev --optimize-autoloader --no-interaction 2>&1 && COMPOSER_OK=1 || echo "UYARI: composer.phar install patladi -> deploy migrate ile devam ediyor."
  else
    echo "UYARI: composer bulunamadi -> Plesk 'Composer' sekmesinden Install calistir!"
  fi
  [ "$COMPOSER_OK" = 1 ] && [ -n "$LOCK_HASH" ] && printf '%s' "$LOCK_HASH" > "$LOCK_MARK"
fi

# Filament statik varliklarini (css/js) public'e yayinla
$PHP artisan filament:assets || echo "UYARI: filament:assets atlandi"

# DIKKAT: migrate --force geri alinamaz. Kritik surumlerde ONCE DB yedegi al
# (Plesk > Databases > Export, ya da mysqldump). migrate TEK kritik adim: patlarsa EXIT 1 ->
# Plesk adimi ⚠️/kirmizi gosterir (dogru davranis; DB semasi kod ile ayrismis demektir, elle
# kontrol et). Yarim uygulanan migration'i GERI ALMAK elle yapilir.
$PHP artisan migrate --force || { echo "HATA: migrate --force basarisiz -> DB semasi kod ile ayrisabilir (500 riski). ELLE kontrol et: php artisan migrate --force"; exit 1; }

# Tarihsel backfill'ler (error-journal + wxp): her ikisi de TUM mac gecmisini tarar (buyuk `log`
# blob'lari) -> her deploy'da kossa deploy lineer yavaslar. YENI maclar zaten CANLI isleniyor
# (error-journal: AnalyzeMatchPrJob + AuthController::analyzeMatch; wxp: AuthController
# ::awardForMatchResult) -> bu backfill'ler yalniz TARIHSEL goc / surum degisimi icin gerekli.
# Marker dosyalariyla gate'le (storage/app/ sunucuda deploy'lar arasi kalici, git'te DEGIL):
#  - error-journal: yalniz ANALYSIS_VERSION artinca (= siniflandirma kodu degisti) yeniden kos.
#  - wxp: tek seferlik tarihsel goc; marker varsa bir daha kosma.
# ponytail: marker dosya bazli; farkli sunuculara/ortama tasinirsa her biri bir kez calisir (zararsiz, idempotent).
EJ_VER=$(sed -n 's/.*ANALYSIS_VERSION = \([0-9][0-9]*\).*/\1/p' app/Support/ErrorJournalConfig.php | head -n1)
EJ_MARK=storage/app/.deploy-ej-version
if [ -z "$EJ_VER" ] || [ "$(cat "$EJ_MARK" 2>/dev/null)" != "$EJ_VER" ]; then
  if $PHP artisan error-journal:backfill; then
    [ -n "$EJ_VER" ] && printf '%s' "$EJ_VER" > "$EJ_MARK"
  else
    echo "UYARI: error-journal:backfill atlandi."
  fi
else
  echo "error-journal:backfill atlandi (ANALYSIS_VERSION=$EJ_VER degismedi)."
fi
WXP_MARK=storage/app/.deploy-wxp-done
if [ ! -f "$WXP_MARK" ]; then
  if $PHP artisan stats:backfill-wxp; then
    touch "$WXP_MARK"
  else
    echo "UYARI: stats:backfill-wxp atlandi."
  fi
else
  echo "stats:backfill-wxp atlandi (tarihsel goc zaten yapildi; yeni kazanclar canli kredilenir)."
fi
# Career PR (PR Sıralaması) aggregate ÖNBELLEĞİ users tablosunda tutulur; maç satırları
# silinince (ör. tavla:purge-old-matches) bayat kalıp "N maç analiz edildi"/PR'ı olduğundan
# YÜKSEK gösterir. Her deploy'da yeniden kur -> match_results ile tutarlı (chunk'li, ucuz).
$PHP artisan careerpr:rebuild || echo "UYARI: careerpr:rebuild atlandi."

$PHP artisan optimize:clear || echo "UYARI: optimize:clear atlandi."
# Filament component/panel cache'ini de temizle: aksi halde YENİ Filament sayfaları (ör. Başarısız
# İşler) canlıda menüde GÖRÜNMEZ (filament:optimize ile önbelleğe alınmış eski liste kalır).
# optimize:clear bunu KAPSAMAZ. Best-effort (komut yoksa/eski sürümse atla).
$PHP artisan filament:optimize-clear 2>/dev/null || $PHP artisan filament:clear-cached-components 2>/dev/null || echo "UYARI: filament cache temizleme atlandi (elle: php artisan filament:optimize-clear)"

# --- Laravel derleme-onbellekleri (her istegi hizlandirir) ---------------------
# optimize:clear yukarida cache'leri TEMIZLER (her istek yeniden parse eder); burada
# GUVENLI olanlari yeniden derleriz. view:cache -> Blade (panel/pay/errors) onceden
# derlenir; event:cache -> event->listener haritasi. config:cache ve route:cache
# KASITLI EKLENMEDI: (1) config:cache -> config DISINDA env() (TourneyBots) null'a doner
# + .env duzenleyince yeniden cache sart (bu kurulumda .env sik elle degisiyor); (2)
# route:cache -> web.php closure action'lari (SPA fallback/SeoMeta, admin SSO, pay onizleme)
# serilestirilemez -> cache PATLAR. Bu ikisi gerekirse ayri is (controller'a tasima + env->config).
# Best-effort: hata deploy'u durdurmasin (set -e'ye karsi || echo).
$PHP artisan event:cache || echo "UYARI: event:cache atlandi."
$PHP artisan view:cache || echo "UYARI: view:cache atlandi."

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
# SEO icerik sayfalarini seed et (firstOrCreate; var olani ezmez -> admin duzenlemeleri korunur).
$PHP artisan seo-pages:import --file=database/data/seo-pages.json || echo "UYARI: seo-pages:import atlandi."
# Sitemap'i senkronla: yayindaki haberler + SeoMeta'daki indekslenecek sayfalar (kendini-onaran).
# news:import'tan SONRA kossun ki haber slug'lari guncel olsun. Panel > Site Ayarlari > "Sitemap
# Guncelle" butonu ayni komutu elle tetikler; burada her deploy'da otomatik calisir.
$PHP artisan seo:sitemap || echo "UYARI: seo:sitemap atlandi."

# --- gnubg analiz motoru + queue worker: kod degisince YENIDEN BASLAT --------------
# SORUN: gnubg motoru /opt/gnubg-service/gnubg_service.py'yi (ayri kopya) uzun-omurlu
# systemd servisinde calistirir; queue worker de eski PHP kodunu tutar. Deploy'da bunlar
# YENILENMEZSE "analiz motoru guncel degil" olur. Best-effort: sudo -n yetkisi varsa
# gnubg_service.py'yi senkronla + servisi restart et; yoksa SESSIZCE gecip elle komutu yaz.
# (cwd = backend/ -> repo koku = ..)
if [ -f ../gnubg-service/gnubg_service.py ]; then
  # SESSIZ ATLAMA TUZAGI (2026-10-11): cp basarisiz olursa eskiden HICBIR SEY basilmazdi -> fix
  # commit'lenir ama /opt'a GITMEZ, duz restart ESKI kodu yukler ("canlida yok" karmasasi). Artik
  # basarisizlik SESLI: elle komutu bas ki gozden kacmasin.
  if sudo -n cp ../gnubg-service/gnubg_service.py /opt/gnubg-service/gnubg_service.py 2>/dev/null; then
    echo "gnubg: gnubg_service.py /opt/gnubg-service'e senkronlandi."
  else
    echo "UYARI: gnubg_service.py SENKRONLANAMADI (sudo -n yok?) -> ELLE: sudo cp $(pwd)/../gnubg-service/gnubg_service.py /opt/gnubg-service/gnubg_service.py && sudo systemctl restart 'gnubg-analysis*'"
  fi
  if sudo -n systemctl restart gnubg-analysis.service 2>/dev/null; then
    echo "gnubg: gnubg-analysis servisi yeniden baslatildi."
  else
    echo "UYARI: gnubg-analysis restart edilemedi -> ELLE: sudo systemctl restart gnubg-analysis.service"
  fi
  # AGIR analiz instance'i (varsa; Level 11/12 concurrency ayrimi) — kurulu degilse SESSIZCE gec.
  if systemctl list-unit-files 2>/dev/null | grep -q '^gnubg-analysis-heavy\.service'; then
    sudo -n systemctl restart gnubg-analysis-heavy.service 2>/dev/null \
      && echo "gnubg: gnubg-analysis-heavy (agir analiz) yeniden baslatildi." \
      || echo "UYARI: gnubg-analysis-heavy restart edilemedi -> ELLE: sudo systemctl restart gnubg-analysis-heavy.service"
  fi
  # A-26: numaralı yedek instance'lar (-3..-N) da AYNI dosyayı çalıştırır; yalnız ilk ikisi yeniden
  # başlatılıyordu -> güvenlik düzeltmeleri bu instance'lara elle restart edilene kadar ulaşmıyordu.
  # Sırayla (biri yeniden başlarken diğerleri failover havuzunda hizmet verir).
  for unit in $(systemctl list-unit-files 2>/dev/null | awk '/^gnubg-analysis-[0-9]+\.service/ {print $1}'); do
    sudo -n systemctl restart "$unit" 2>/dev/null \
      && echo "gnubg: $unit yeniden baslatildi." \
      || echo "UYARI: $unit restart edilemedi -> ELLE: sudo systemctl restart $unit"
    # Stagger: biri yeniden baslarken digerleri failover havuzunda hizmet versin. 2sn -> 0.5sn
    # (N instance'ta 2sn deploy'u ~N*2sn uzatiyordu; 0.5sn stagger'i korur, ~4x hizli).
    sleep 0.5
  done
  # DEPLOY HEALTH-GATE (2026-10-12): restart'lardan sonra instance'lar GERCEKTEN ayaga kalkti mi?
  # Eskiden dogrulama yoktu -> bozuk/surum-kaymis deploy (symlink kirik, .py syntax hatasi, port
  # bind hatasi) SESSIZCE gecer, siradaki maca kadar fark edilmezdi. Burada her gnubg unit'in
  # is-active'ini + birincil :8092 /health'ini yoklayip basarisizi SESLI basiyoruz (deploy'u
  # DURDURMAZ; failover havuzu digerlerini servis eder, ama admin hemen gorur).
  # ponytail: is-active crash-on-boot/StartLimit-failed'i yakalar; analyse-match SEGV'ini DEGIL
  # (onu services:watch GNUBG_WATCH_HEAVY=1 heavy-probe'u yakalar). Islevsel smoke = tek /health.
  sleep 3 # RestartSec=3: hemen craslayan unit 'active'den 'failed'a dussun
  gnubg_bad=0
  for unit in $(systemctl list-unit-files 2>/dev/null | awk '/^gnubg-analysis(-([0-9]+|heavy))?\.service/ {print $1}'); do
    if ! systemctl is-active --quiet "$unit" 2>/dev/null; then
      echo "ALARM: $unit deploy sonrasi AYAKTA DEGIL ($(systemctl is-active "$unit" 2>/dev/null)) -> SSH: systemctl status $unit -n30"
      gnubg_bad=1
    fi
  done
  # Islevsel smoke: birincil instance /health'e cevap veriyor mu (bind + servis dongusu calisiyor)?
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsS --max-time 5 http://127.0.0.1:8092/health >/dev/null 2>&1; then
      echo "ALARM: gnubg birincil :8092 /health cevap VERMIYOR (motor acilista craslamis olabilir) -> SSH: systemctl status gnubg-analysis -n30"
      gnubg_bad=1
    fi
  fi
  [ "$gnubg_bad" = 0 ] && echo "gnubg: tum instance'lar deploy sonrasi AYAKTA (health-gate yesil)."
fi
# Queue worker (gnubg PR shadow) eski kodu calistirir -> her deploy'da yenile (bkz deploy/README).
if sudo -n systemctl restart tavla-queue 2>/dev/null; then
  echo "tavla-queue yeniden baslatildi."
else
  $PHP artisan queue:restart >/dev/null 2>&1 \
    && echo "queue:restart sinyali gonderildi (worker sonraki job'da yeni kodu alir)." \
    || echo "UYARI: tavla-queue yenilenemedi -> ELLE: sudo systemctl restart tavla-queue"
fi
# Adanmis review-warmup worker'i (Analiz onbellek backfill, 'reviews' kuyrugu) — kuruluysa yenile.
if systemctl list-unit-files 2>/dev/null | grep -q '^tavla-review-queue\.service'; then
  sudo -n systemctl restart tavla-review-queue 2>/dev/null \
    && echo "tavla-review-queue yeniden baslatildi." \
    || echo "UYARI: tavla-review-queue yenilenemedi -> ELLE: sudo systemctl restart tavla-review-queue"
fi
# Reverb WebSocket sunucusu (gercek-zamanli oda push) — uzun-omurlu PHP daemon'u eski Event/payload
# kodunu tutar -> kuruluysa her deploy'da yenile (bkz deploy/README.md + deploy/tavla-reverb.service).
if systemctl list-unit-files 2>/dev/null | grep -q '^tavla-reverb\.service'; then
  sudo -n systemctl restart tavla-reverb 2>/dev/null \
    && echo "tavla-reverb yeniden baslatildi." \
    || echo "UYARI: tavla-reverb yenilenemedi -> ELLE: sudo systemctl restart tavla-reverb"
fi
# -----------------------------------------------------------------------------

# ================== POST-DEPLOY SAĞLIK KAPISI (önlem) ==================
# event:cache/view:cache bazen (eşzamanlı oturumun değişen kodunda) BOZUK cache üretip HER
# isteği 500'e düşürdü -> site deploy SONRASI kapalı kaldı, elle `optimize:clear` ile açıldı.
# Bu kapı: deploy sonunda app'i /up ile yokla; 5xx ise bozuk cache'i TEMIZLE (cache'siz ama
# ÇALIŞAN duruma düş) + tekrar yokla. Deploy ASLA siteyi 500'de bırakmasın. (curl yoksa/ulaşamazsa
# cache'e DOKUNULMAZ -> gereksiz cache kaybı yok; yalnız kesin 5xx'te iyileştir.)
HEALTH_URL="https://www.tavlatv.com/up"
HCODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" 2>/dev/null || echo 000)
if [ "$HCODE" -ge 500 ] 2>/dev/null; then
  echo "SAGLIK KAPISI: app $HCODE (BOZUK) -> bootstrap/cache ham temizleme + optimize:clear (fail-safe)."
  # ONCE ham dosya silme: bozuk/yarida-yazilmis bootstrap/cache/packages.php|services.php
  # artisan'in KENDISINI acilista patlatir -> optimize:clear CALISAMAZ (2026-10-18 olayi).
  # rm PHP gerektirmez, her zaman calisir; manifestler sonraki istekte yeniden uretilir.
  rm -f bootstrap/cache/*.php 2>/dev/null; rm -rf bootstrap/cache/filament 2>/dev/null
  $PHP artisan optimize:clear || true
  HCODE2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" 2>/dev/null || echo 000)
  if [ "$HCODE2" -ge 500 ] 2>/dev/null || [ "$HCODE2" = "000" ]; then
    echo "🔴 SAGLIK KAPISI: temizlik sonrasi HALA $HCODE2 -> KOD HATASI olabilir, storage/logs/laravel.log'a bak!"
  else
    echo "SAGLIK KAPISI: temizlik sonrasi $HCODE2 -> app GERI GELDI (cache'siz calisiyor; sonraki deploy yeniden cache'ler)."
  fi
elif [ "$HCODE" = "000" ]; then
  echo "UYARI: SAGLIK KAPISI probe'u ulasamadi (ag/DNS/loopback?) -> cache DOKUNULMADI, canliyi elle dogrula."
else
  echo "SAGLIK KAPISI: app sagligi $HCODE (OK)."
fi

echo "Deploy tamam: migrate + cache + saglik kapisi + haber importu + gnubg/queue restart."

# Plesk "additional deployment actions" adimi YESIL olsun: buraya kadar geldiyse migrate basarili
# (yoksa yukarida exit 1 olurdu) ve gerisi best-effort tamamlandi -> kasitli basarili cikis.
exit 0
