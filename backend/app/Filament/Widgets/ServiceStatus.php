<?php

namespace App\Filament\Widgets;

use App\Services\GnuBg\GnuBgClient;
use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Filament\Notifications\Notification;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Servis durumu paneli (admin dashboard): ÇALIŞAN TÜM servislerin yeşil/kırmızı lambası —
 * Node validator (maç hakemi), gnubg analiz servisi, veritabanı, queue worker (shadow PR+luck).
 * Ayrıca otorite + PR/luck modu. Validator "Yeniden Başlat" butonu (süreç exit -> Passenger
 * canlandırır). Her kontrol ~10sn cache + 30sn poll.
 */
class ServiceStatus extends Widget
{
    protected static string $view = 'filament.widgets.service-status';

    protected static ?int $sort = -4; // en üstte

    protected int|string|array $columnSpan = 'full';

    protected static ?string $pollingInterval = '30s'; // lambalar otomatik tazelensin

    /** Blade'in okuduğu durum: tüm servislerin lambaları + otorite/PR/luck modu. */
    public function status(): array
    {
        try {
            $data = Cache::remember('admin:services-status', now()->addSeconds(10), function () {
                $client = app(GnuBgClient::class);
                $units = $client->unitNames();
                $vres = $this->checkValidators();

                // gnubg havuzları ROL BAZLI ayrı gruplar (kullanıcı zihin modeli): Canlı YZ (Yapay Zeka
                // ile Oyna) / PR analizi (maç sonu) / Mat-Pozisyon analizi (ağır). İnsan-vs-insan maçları
                // (Tek Oyun/Maç/Arkadaş) gnubg KULLANMAZ -> yalnız validator'a bağlı.
                $frontRows = $this->checkGnubgPool($client->foregroundBases(), 'gnubg — Canlı YZ (Yapay Zeka ile Oyna)', $units);
                $prRows = $this->checkGnubgPool($client->backgroundBases(), 'gnubg — PR Analizi (maç sonu)', $units);
                $matRows = $this->checkGnubgPool($this->heavyBasesRaw($client), 'gnubg — Mat / Pozisyon Analizi (ağır)', $units);

                $upCount = fn ($rows) => collect($rows)->filter(fn ($r) => ($r['up'] ?? null) === true)->count();
                $frontUp = $upCount($frontRows);
                $bgUp = $upCount($prRows);

                return [
                    'services' => [
                        // Hakem: hem insan hem YZ maçlarının hamle yasallığı.
                        ...array_map(fn ($r) => $r + ['group' => 'Hakem (tüm maçlar)'], $vres['rows']),
                        // İKİ NET ÖZET: hangi maç türü şu an oynanabilir.
                        $this->checkHumanMatches($vres['up'], count($vres['rows'])),
                        $this->checkAiMatches($vres['up'], $frontUp, count($frontRows), $bgUp),
                        // gnubg instance'ları rol gruplarıyla (Canlı YZ / PR / Mat) AYRI lamba.
                        ...$frontRows,
                        ...$prRows,
                        ...$matRows,
                        // Maç-içi ısıtma işçileri AYRI grup (gnubg havuzlarıyla ilişkili, altyapıdan bağımsız).
                        ...array_map(fn ($r) => $r + ['group' => 'Maç-içi Isıtma İşçileri (warm)'], $this->warmRows()),
                        // Altyapı.
                        $this->checkDatabase() + ['group' => 'Altyapı'],
                        // Kuyruk işçileri KUYRUK-BAZLI ayrı lamba (default/reviews/backfill): tek 'queue' lambası
                        // herhangi bir worker'ın nabzına bakıp bir kuyruk ölse de yeşil kalıyordu (kör nokta).
                        ...$this->queueRows(),
                        $this->checkScheduler() + ['group' => 'Altyapı'],
                        $this->checkDisk() + ['group' => 'Altyapı'],
                    ],
                    'validator_required' => (bool) config('validator.required', true),
                ];
            });
        } catch (\Throwable $e) {
            // Sağlık paneli, izlediği admin panelini ASLA 500'le düşürmemeli. Herhangi bir probe
            // (validator/gnubg), DB, exec ya da render öncesi hata -> görünür kırmızı satıra degrade;
            // gerçek mesajı panelde göster (log'a gerek kalmadan kök neden okunur).
            $data = [
                'services' => [[
                    'key' => 'healthcheck',
                    'name' => 'Servis Durumu (kendi kontrolü)',
                    'configured' => true,
                    'up' => false,
                    'detail' => 'Sağlık kontrolü hata verdi: '.$e->getMessage(),
                    'restart' => false,
                    'group' => 'Altyapı',
                ]],
                'validator_required' => (bool) config('validator.required', true),
            ];
        }

        // Gruplama/sayım blade'de @php BLOK'unda yapılıyordu; o blok (// yorumlu) sunucu Blade
        // derleyicisinde $down tanımını yutup "Undefined variable $down" -> 500 veriyordu. Mantık
        // buraya (PHP, try/catch kapsamında) taşındı; blade yalnız hazır dizileri okur.
        $services = $data['services'];
        $groups = [];
        foreach ($services as $svc) {
            $groups[$svc['group'] ?? 'Diğer'][] = $svc;
        }

        return [
            'services' => $services,
            'validator_required' => $data['validator_required'],
            'authoritative' => (bool) config('game.server_authoritative', false),
            'pr_mode' => (string) config('validator.pr_mode', 'off'),
            'gnubg_pr_mode' => (string) config('gnubg.pr_mode', 'off'),
            'groups' => $groups,
            'down' => collect($services)->filter(fn ($x) => ($x['up'] ?? null) === false)->values(),
            'total' => count($services),
            'okN' => collect($services)->filter(fn ($x) => ($x['up'] ?? null) === true)->count(),
        ];
    }

    /**
     * Node validator(lar) — birincil + yedek(ler) AYRI lamba. Her tabanı DOĞRUDAN yoklar (failover'sız)
     * ki panelde "birincil düştü, yedek ayakta" durumu NET görünsün. Dönüş: ['rows'=>satırlar, 'up'=>en az biri].
     */
    private function checkValidators(): array
    {
        $validator = app(MoveValidatorService::class);
        $bases = $validator->bases();
        if (count($bases) === 0) {
            return [
                'rows' => [$this->svc('validator', 'Sunucu Hakem (Validator)', false, null, 'Yapılandırılmamış', true)],
                'up' => false,
            ];
        }
        $s = Backgammon::initialState();
        $s['dice'] = [3, 1];
        $s['diceUsed'] = [false, false];
        $steps = [['from' => 5, 'to' => 2, 'die' => 3], ['from' => 2, 'to' => 1, 'die' => 1]];

        $rows = [];
        $anyUp = false;
        foreach ($bases as $i => $base) {
            $up = $validator->probeBase($base, $s, $steps);
            $anyUp = $anyUp || $up;
            $label = $i === 0
                ? 'Sunucu Hakem (Validator) — Birincil'
                : 'Sunucu Hakem (Validator) — Yedek #'.$i;
            // İŞÇİ SAYISI: cluster örneği kaç paralel işçiyle koşuyor (8091 = 6). /health'ten oku,
            // >1 ise adrese "· N işçi" ekle -> panelde kapasite net görünür (kullanıcı "6 tane" sordu).
            $detail = $base;
            if ($up) {
                $w = (int) (($validator->healthAt($base)['workers'] ?? 0));
                if ($w > 1) {
                    $detail .= ' · '.$w.' işçi (paralel)';
                }
            }
            // Restart butonu yalnız BİRİNCİL satırda (restartValidator() zaten TÜM tabanlara /restart yollar).
            $rows[] = $this->svc('validator'.($i === 0 ? '' : '-'.$i), $label, true, $up, $detail, $i === 0);
        }

        return ['rows' => $rows, 'up' => $anyUp];
    }

    /**
     * gnubg analiz instance'ları (PR + native luck kaynağı) — birincil + yedek(ler) AYRI lamba. Her
     * tabanı DOĞRUDAN /health ile yoklar ki panelde "birincil düştü, yedek ayakta" NET görünsün. PR +
     * canlı bot analyze()'ı failover ile bu instance'lardan çağırır -> EN AZ BİR yeşil = PR asla boş.
     */
    /**
     * TEK bir gnubg HAVUZUNU (rol grubu) instance-instance yokla. Her instance için ayrı lamba +
     * (birim biliniyorsa) restart. key = 'gnubgp-{port}' -> restartService port→birim eşler.
     * $group Blade'de grup başlığı olur (Canlı YZ / PR / Mat ayrımı net görünsün).
     */
    private function checkGnubgPool(array $bases, string $group, array $units): array
    {
        if ($bases === []) {
            return [$this->svc('gnubg-'.md5($group), $group.' — yapılandırılmamış', false, null, 'Bu havuz için URL tanımlı değil') + ['group' => $group]];
        }
        $client = app(GnuBgClient::class);
        $rows = [];
        foreach ($bases as $i => $base) {
            try {
                $info = $client->healthInfoAt($base); // {ok,version,inflight,peak_inflight} veya null
                $up = $info !== null && ($info['ok'] ?? false) === true;
            } catch (\Throwable $e) {
                $info = null;
                $up = false;
            }
            $port = (int) (parse_url($base, PHP_URL_PORT) ?: 0);
            $unit = $this->unitForPort($port, $units);
            $label = 'Analiz #'.($i + 1).' (:'.$port.')';
            $detail = $up ? $base : $base.' — '.$this->gnubgDownReason($unit);
            if ($up && isset($info['peak_inflight'])) {
                $peak = (int) $info['peak_inflight'];
                $nowN = (int) ($info['inflight'] ?? 0);
                $detail .= " · eşzamanlı: şu an {$nowN}, tepe {$peak}";
            }
            // Restart butonu: Forge supervisor her gnubg instance'ı port→'gnubg:gnubg-<port>' ile yeniden
            // başlatabilir (systemd GNUBG_UNITS haritası gerekmez) -> port biliniyorsa her zaman göster.
            $rows[] = $this->svc('gnubgp-'.$port, $label, true, $up, $detail, $port > 0) + ['group' => $group];
        }

        return $rows;
    }

    /** Mat/ağır analiz havuzunun HAM listesi (heavyBases() shuffle eder -> panelde stabil sıra için config'ten). */
    private function heavyBasesRaw(GnuBgClient $client): array
    {
        $pool = array_values(array_filter(array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.heavy_urls', '')),
        ), fn ($u) => $u !== ''));
        if ($pool === []) {
            $single = (string) (config('gnubg.heavy_url') ?: '');
            if ($single !== '') {
                $pool = [rtrim($single, '/')];
            }
        }

        return $pool;
    }

    /** Port → systemd birim adı (konvansiyon: 8092=gnubg-analysis, 8093=gnubg-analysis-heavy, 8091+N=gnubg-analysis-N). Yalnız GNUBG_UNITS'te varsa döner (izlenen/restart edilebilir). */
    private function unitForPort(int $port, array $units): ?string
    {
        if ($port <= 0) {
            return null;
        }
        $cand = match ($port) {
            8092 => 'gnubg-analysis',
            8093 => 'gnubg-analysis-heavy',
            default => 'gnubg-analysis-'.($port - 8091),
        };

        return in_array($cand, $units, true) ? $cand : null;
    }

    /** gnubg KIRMIZIyken nedenini teşhis et: symlink kırık / dosya yok / servis kapalı. */
    private function gnubgDownReason(?string $unit = 'gnubg-analysis'): string
    {
        $file = (string) config('gnubg.service_file', '');
        if ($file !== '') {
            // Kırık symlink: is_link true ama file_exists (hedefi izler) false -> tam bugünkü durum.
            if (@is_link($file) && ! @file_exists($file)) {
                $target = @readlink($file) ?: '?';

                return 'SYMLINK KIRIK: '.$file.' → '.$target.' (hedef yok; domain/yol değiştiyse symlink\'i güncelle)';
            }
            if (! @file_exists($file)) {
                return 'DOSYA YOK: '.$file.' (systemd bu yolu bekliyor)';
            }
        }

        $u = $unit ?: 'gnubg-analysis';

        return 'servis kapalı — SSH: systemctl restart '.$u.' (durum: systemctl status '.$u.')';
    }

    /** Veritabanı: basit "select 1". */
    private function checkDatabase(): array
    {
        try {
            DB::select('select 1');
            $name = (string) (config('database.connections.'.config('database.default').'.database') ?? '');

            return $this->svc('db', 'Veritabanı', true, true, $name !== '' ? $name : config('database.default'));
        } catch (\Throwable $e) {
            return $this->svc('db', 'Veritabanı', true, false, 'Bağlanılamadı');
        }
    }

    /**
     * Kuyruk işçileri KUYRUK-BAZLI ayrı lamba (default / reviews / backfill). Eskiden TEK 'queue' lambası
     * ortak 'queue:worker:heartbeat' nabzına bakıyordu -> bir kuyruğun worker'ı tamamen ölse bile BAŞKA
     * kuyruğun worker'ı nabız bıraktığı için YEŞİL kalıyordu (kör nokta: canlı 'reviews' çökse "queue"
     * yeşil görünür). Artık her kuyruk AYRI: o kuyruğu işleyen süreç sayısı (pgrep --queue=X) + o kuyruğun
     * derinliği/yaşı. İşçi var -> yeşil (yığını eritir); işçi yok + eski bekleyen iş -> kırmızı (worker
     * kapalı); işçi sayılamadı + iş yok -> gri (ayırt edilemez). warm AYRI (warmRows).
     */
    private function queueRows(): array
    {
        // [key, DB kuyruk adları, pgrep deseni (bracket-trick: pgrep kendini saymasın), etiket]
        $defs = [
            ['default', ['default'], "[q]ueue:work.*[q]ueue='default'", 'Kuyruk: Canlı PR/Luck (default)'],
            ['reviews', ['reviews'], "[q]ueue:work.*[q]ueue='reviews'", 'Kuyruk: Maç-sonu Review (reviews)'],
            ['backfill', ['reviews-bulk', 'bulk'], "[q]ueue:work.*[q]ueue='reviews-bulk", 'Kuyruk: Backfill (reviews-bulk/bulk)'],
        ];
        try {
            $failed = (int) DB::table('failed_jobs')->count();
        } catch (\Throwable $e) {
            $failed = 0;
        }
        $rows = [];
        $failedShown = false;
        foreach ($defs as [$key, $queues, $pat, $label]) {
            try {
                $depth = (int) DB::table('jobs')->whereIn('queue', $queues)->count();
                $oldest = $depth > 0 ? (int) DB::table('jobs')->whereIn('queue', $queues)->min('available_at') : 0;
            } catch (\Throwable $e) {
                $rows[] = $this->svc('q-'.$key, $label, true, null, 'jobs tablosu okunamadı') + ['group' => 'Kuyruk İşçileri'];

                continue;
            }
            $procs = $this->queueProcCount($pat);
            $age = $oldest ? (time() - $oldest) : 0;
            $wtxt = $procs > 0 ? $procs.' işçi' : 'işçi süreci yok';
            if ($procs > 0) {
                $up = true;
                $detail = $wtxt.' · '.($depth === 0 ? 'boşta (iş yok)' : "{$depth} iş bekliyor, en eski {$age}sn");
            } elseif ($depth === 0) {
                $up = null; // süreç sayılamadı (exec kapalı) + iş yok -> ayırt edilemez
                $detail = 'Boşta ('.$wtxt.', bekleyen iş yok)';
            } else {
                $up = $age < 90;
                $detail = "{$depth} iş bekliyor, en eski {$age}sn · {$wtxt}".($up ? '' : ' — işçi KAPALI olabilir');
            }
            if (! $failedShown && $failed > 0) {
                $detail .= " · ⚠ {$failed} başarısız iş";
                $failedShown = true;
            }
            $rows[] = $this->svc('q-'.$key, $label, true, $up, $detail) + ['group' => 'Kuyruk İşçileri'];
        }

        return $rows;
    }

    /** Belirli kuyruğu işleyen queue:work süreç sayısı (pgrep -fc; desen bracket-trick ile pgrep kendini saymaz). exec yoksa 0. */
    private function queueProcCount(string $pattern): int
    {
        if (! function_exists('exec')) {
            return 0;
        }
        $o = [];
        @exec('pgrep -fc '.escapeshellarg($pattern).' 2>/dev/null', $o);

        return max(0, (int) trim((string) ($o[0] ?? '0')));
    }

    /**
     * Maç-içi gnubg ısıtma işçisi: WarmMatchAnalysisJob 'warm' kuyruğuna (RoomController her hamle) düşer,
     * DEDİKE tavla-warm-queue@ worker'ları yalnız onu işler (backfill'den İZOLE -> canlı maç-sonu PR'ın
     * anında gelmesi buna bağlı; gnubg havuzu da ayrı: GNUBG_ANALYSIS_URLS). CANLILIK: --queue=warm süreç
     * sayısı + 'warm' kuyruk derinliği/yaşı. Süreç varsa yeşil (yığını eritir); süreç yok + eski bekleyen
     * iş varsa kırmızı (ısıtma durdu -> maç-sonu PR cache miss -> yavaşlar).
     */
    private function checkWarmWorker(): array
    {
        try {
            $depth = (int) DB::table('jobs')->where('queue', 'warm')->count();
            $oldest = $depth > 0 ? (int) DB::table('jobs')->where('queue', 'warm')->min('available_at') : 0;
        } catch (\Throwable $e) {
            return $this->svc('warm', 'Maç-içi Isıtma İşçisi (warm)', true, null, 'jobs tablosu okunamadı', false);
        }
        $procs = $this->warmWorkerCount();
        $age = $oldest ? (time() - $oldest) : 0;
        $wtxt = $procs > 0 ? $procs.' işçi' : 'işçi süreci sayılamadı';
        if ($procs > 0) {
            $detail = $wtxt.' · '.($depth === 0 ? 'boşta (ısıtma işi yok)' : "{$depth} ısıtma işi, en eski {$age}sn")
                .' — maç-içi gnubg ısıtma (backfill\'den izole)';

            return $this->svc('warm', 'Maç-içi Isıtma İşçisi (warm)', true, true, $detail, false);
        }
        if ($depth === 0) {
            // Süreç sayılamadı (exec kapalı) + bekleyen iş yok -> ayırt edilemez (gri).
            return $this->svc('warm', 'Maç-içi Isıtma İşçisi (warm)', true, null, 'Boşta ('.$wtxt.', bekleyen ısıtma işi yok)', false);
        }
        $up = $age < 90; // eski bekleyen iş -> worker muhtemelen kapalı
        $detail = "{$depth} ısıtma işi bekliyor, en eski {$age}sn · ".$wtxt
            .($up ? '' : ' — işçi kapalı olabilir (ısıtma durdu, maç-sonu PR yavaşlar)');

        return $this->svc('warm', 'Maç-içi Isıtma İşçisi (warm)', true, $up, $detail, false);
    }

    /**
     * İNSAN-vs-İNSAN maçları (Tek Oyun · Maç Oyunu · Arkadaşınla Oyna): YALNIZ validator'a bağlı
     * (hamle yasallığı hakemi). gnubg KULLANMAZ -> analiz servisleri tamamen düşse bile insan
     * maçları oynanır. Bu satır oyuncu-vs-oyuncu akışının canlılığını tek bakışta gösterir.
     */
    private function checkHumanMatches(bool $vUp, int $vCount): array
    {
        $detail = $vUp
            ? 'Oynanabilir — hakem (validator) ayakta. gnubg gerekmez; analiz servisleri düşse bile etkilenmez.'
            : 'Oynatılamaz — hakem (validator) erişilemiyor (authoritative maçta hamleler reddedilir).';

        return $this->svc('human-matches', 'İnsan Maçları — Tek Oyun · Maç · Arkadaş', true, $vUp, $detail)
            + ['group' => 'Maç Türleri (oynanabilirlik)'];
    }

    /**
     * YZ MAÇI (Yapay Zeka ile Oyna): validator (hakem) + CANLI YZ gnubg ön havuzundan EN AZ BİR
     * instance gerektirir (bot beynini ön havuz sağlar; ön havuz tümü düşerse PR havuzuna failover
     * eder -> hâlâ oynanır ama daha yavaş). Ön havuz kapasitesini (N/M) gösterir -> "güçlü mü" net.
     */
    private function checkAiMatches(bool $vUp, int $frontUp, int $frontTotal, int $bgUp): array
    {
        $engineUp = $frontUp > 0 || $bgUp > 0; // ön havuz yoksa PR havuzuna failover (analyze() yolu)
        $up = $vUp && $engineUp;
        if (! $up) {
            $need = [];
            if (! $engineUp) {
                $need[] = 'analiz servisi (gnubg — tüm havuzlar düşük)';
            }
            if (! $vUp) {
                $need[] = 'validator (hakem)';
            }
            $detail = 'Oynatılamaz — gerekli: '.implode(' + ', $need);
        } else {
            $detail = "Oynanabilir — canlı YZ havuzu {$frontUp}/{$frontTotal} ayakta + hakem.";
            if ($frontUp === 0) {
                $detail = "Oynanabilir ama YAVAŞ — canlı YZ havuzu 0/{$frontTotal} (PR havuzuna failover, {$bgUp} ayakta). Ön havuzu ayağa kaldır!";
            } elseif ($frontTotal > 0 && $frontUp <= (int) ceil($frontTotal / 2)) {
                $detail .= ' — kapasite DÜŞÜK (yoğunlukta bot hamlesi bekleyebilir).';
            }
        }

        return $this->svc('ai-matches', 'YZ Maçı — Yapay Zeka ile Oyna', true, $up, $detail)
            + ['group' => 'Maç Türleri (oynanabilirlik)'];
    }

    /**
     * Zamanlayıcı (cron): schedule:run gerçekten çalışıyor mu? routes/console.php'deki nabız her
     * dakika 'ops:cron:heartbeat' cache'ini tazeler. Bayatsa cron DURMUŞ -> services:watch dahil
     * TÜM izleme/otomatik-restart/alarm sessizce çalışmıyor demektir (en kritik kör nokta).
     */
    private function checkScheduler(): array
    {
        $hb = (int) (Cache::get('ops:cron:heartbeat') ?? 0);
        if ($hb === 0) {
            return $this->svc('scheduler', 'Zamanlayıcı (cron)', true, null,
                'Henüz nabız yok — yeni kurulduysa ~1-2 dk bekleyin. Sürerse: "* * * * * php artisan schedule:run" cron\'u tanımlı mı?');
        }
        $age = time() - $hb;
        $up = $age < 150; // ~2.5 dk tolerans (dakikalık nabız + gecikme payı)
        $detail = $up
            ? "Çalışıyor — en son {$age}sn önce"
            : "SON NABIZ {$age}sn önce — cron DURMUŞ olabilir (schedule:run). İzleme/otomatik-restart/alarm ÇALIŞMIYOR!";

        return $this->svc('scheduler', 'Zamanlayıcı (cron)', true, $up, $detail);
    }

    /** Disk alanı: additive deploy (backend/public/assets) + gnubg .mat + loglar zamanla büyür. */
    private function checkDisk(): array
    {
        try {
            $path = base_path();
            $free = @disk_free_space($path);
            $total = @disk_total_space($path);
            if (! $free || ! $total) {
                return $this->svc('disk', 'Disk Alanı', true, null, 'Ölçülemedi');
            }
            $usedPct = (int) round((1 - $free / $total) * 100);
            $freeGb = round($free / 1073741824, 1);
            $up = $usedPct < 90 ? true : ($usedPct < 97 ? null : false); // <90 yeşil, 90-96 sarı(gri), 97+ kırmızı
            $detail = "%{$usedPct} kullanımda · {$freeGb} GB boş";
            if ($usedPct >= 90) {
                $detail .= ' — TEMİZLİK GEREKLİ (eski hash\'li asset / log / .mat)';
            }

            return $this->svc('disk', 'Disk Alanı', true, $up, $detail);
        } catch (\Throwable $e) {
            return $this->svc('disk', 'Disk Alanı', true, null, 'Ölçülemedi');
        }
    }

    /** Çalışan DEDİKE warm işçisi sayısı (tavla-warm-queue@ -> --queue=warm). exec yoksa 0. */
    private function warmWorkerCount(): int
    {
        if (! function_exists('exec')) {
            return 0;
        }
        $o = [];
        @exec('pgrep -fc "queue:work database --queue=warm" 2>/dev/null', $o);

        return max(0, (int) trim((string) ($o[0] ?? '0')));
    }

    /**
     * Maç-içi ısıtma işçileri: tavla-warm-queue@N (DEDİKE 'warm' worker'ları) — gnubg havuzları gibi HER
     * instance AYRI lamba + restart. systemctl'den enumerate edilir; exec yok/birim bulunamazsa tek-özet
     * satıra (checkWarmWorker) düşer. 'warm' kuyruk derinliği ilk satırın detayında (yığın = ısıtma geride).
     */
    private function warmRows(): array
    {
        $units = $this->warmUnits(); // ['tavla-warm-queue@1' => true(active), ...] doğal sıralı
        if ($units === []) {
            return [$this->checkWarmWorker()]; // fallback: tek özet (süreç sayısı)
        }
        try {
            $depth = (int) DB::table('jobs')->where('queue', 'warm')->count();
            $oldest = $depth > 0 ? (int) DB::table('jobs')->where('queue', 'warm')->min('available_at') : 0;
        } catch (\Throwable $e) {
            $depth = 0;
            $oldest = 0;
        }
        $age = $oldest ? (time() - $oldest) : 0;
        $queueTxt = $depth === 0 ? 'kuyruk boş (ısıtma güncel)' : "{$depth} ısıtma işi bekliyor, en eski {$age}sn";
        $rows = [];
        $first = true;
        foreach ($units as $unit => $active) {
            $n = preg_match('/@(\d+)/', $unit, $m) ? $m[1] : '?';
            $detail = $active ? 'çalışıyor' : 'DURMUŞ — yeniden başlat';
            if ($first) {
                $detail .= ' · '.$queueTxt;
                $first = false;
            }
            $rows[] = $this->svc('warm-'.$n, 'Maç-içi Isıtma İşçisi #'.$n.' (warm)', true, $active, $detail, true);
        }

        return $rows;
    }

    /** tavla-warm-queue@N birimlerini systemctl'den oku -> ['birim'=>aktif mi]. exec yoksa []. */
    private function warmUnits(): array
    {
        if (! function_exists('exec')) {
            return [];
        }
        $o = [];
        @exec("systemctl list-units 'tavla-warm-queue@*.service' --all --no-legend --plain 2>/dev/null", $o);
        $out = [];
        foreach ($o as $line) {
            $parts = preg_split('/\s+/', trim((string) $line));
            if (! is_array($parts) || ! str_contains((string) ($parts[0] ?? ''), 'tavla-warm-queue@')) {
                continue;
            }
            $unit = preg_replace('/\.service$/', '', $parts[0]); // UNIT LOAD ACTIVE SUB ...
            $out[$unit] = (($parts[2] ?? '') === 'active');
        }
        ksort($out, SORT_NATURAL);

        return $out;
    }

    /** Servis satırı: up=true yeşil, false kırmızı, null gri (boşta/yapılandırılmamış). */
    private function svc(string $key, string $name, bool $configured, ?bool $up, string $detail, bool $restart = false): array
    {
        return compact('key', 'name', 'configured', 'up', 'detail', 'restart');
    }

    /**
     * "Yeniden Başlat" butonu. validator -> HTTP /restart (Passenger canlandırır). gnubg/queue ->
     * systemd (sudo -n systemctl restart; izin yoksa uyarı + SSH komutu gösterir).
     */
    public function restartService(string $key): void
    {
        Cache::forget('admin:services-status'); // durum yeniden ölçülsün

        if ($key === 'validator') {
            $r = app(MoveValidatorService::class)->restartValidator();
            Cache::forget('admin:validator-status');
            if (! empty($r['ok'])) {
                Notification::make()->title('Validator yeniden başlatılıyor…')
                    ->body('Süreç kapandı; birkaç saniye içinde otomatik canlanır.')->success()->send();
            } elseif (($r['error'] ?? '') === 'status-404') {
                Notification::make()->title('Validator eski sürümde')
                    ->body('Çalışıyor ama /restart ucu yok. Plesk → Node uygulaması → Restart App ile BİR KEZ elle yeniden başlat.')
                    ->warning()->persistent()->send();
            } else {
                Notification::make()->title('Yeniden başlatılamadı')
                    ->body('Hata: '.($r['error'] ?? 'bilinmiyor').' — validator ayakta değilse önce Plesk\'ten başlat.')
                    ->danger()->send();
            }

            return;
        }

        // gnubgp-{port} -> Forge supervisor program'ı 'gnubg:gnubg-<port>' (bkz /etc/supervisor/conf.d/
        // gnubg.conf). systemctlRestart ':' görünce supervisorctl kullanır -> GNUBG_UNITS systemd haritasına
        // ARTIK GEREK YOK (port doğrudan supervisor program adına eşlenir). Eski 'gnubg'/'gnubg-N' systemd
        // anahtarları (GNUBG_UNITS bazlı) geriye dönük korunur.
        $unit = null;
        if (str_starts_with($key, 'gnubgp-')) {
            $port = (int) substr($key, strlen('gnubgp-'));
            $unit = 'gnubg:gnubg-'.$port;
        } elseif ($key === 'gnubg' || str_starts_with($key, 'gnubg-')) {
            $idx = $key === 'gnubg' ? 0 : (int) substr($key, strlen('gnubg-'));
            $units = app(GnuBgClient::class)->unitNames();
            $unit = $units[$idx] ?? null;
            if (! $unit) {
                Notification::make()->title('Bu instance için birim adı tanımlı değil')
                    ->body('GNUBG_UNITS env\'ine bu instance\'ın systemd birim adını ekle (bases sırasıyla). SSH: systemctl restart <birim>.')
                    ->warning()->persistent()->send();

                return;
            }
        } elseif ($key === 'queue') {
            $unit = 'tavla-queue';
        } elseif (str_starts_with($key, 'warm-')) {
            $unit = 'tavla-warm-queue@'.((int) substr($key, strlen('warm-'))); // maç-içi ısıtma işçisi
        }
        if (! $unit) {
            Notification::make()->title('Bilinmeyen servis')->danger()->send();

            return;
        }
        [$ok, $out] = $this->systemctlRestart($unit);
        if ($ok) {
            Notification::make()->title($unit.' yeniden başlatıldı')
                ->body('Servis yenilendi. Durum birkaç saniyede güncellenecek.')->success()->send();
        } else {
            Notification::make()->title($unit.' yeniden başlatılamadı')
                ->body('sudo izni gerekebilir (bkz deploy notu). SSH: `systemctl restart '.$unit.'`. Detay: '.($out ?: 'izin yok'))
                ->warning()->persistent()->send();
        }
    }

    /**
     * Servisi best-effort yeniden başlat (sudo -n; izin yoksa false + çıktı). Üretim artık Forge +
     * SUPERVISOR (systemd DEĞİL) -> önce supervisorctl denenir. Birim adı ':' içeriyorsa (gnubg:gnubg-8092
     * gibi grup:program) yalnız supervisor; içermiyorsa (eski Hetzner systemd birimi) supervisor dener,
     * tutmazsa systemd'ye düşer (geriye dönük uyum).
     */
    private function systemctlRestart(string $unit): array
    {
        if (! function_exists('exec')) {
            return [false, 'exec kapalı (paylaşımlı hosting)'];
        }
        $cmds = str_contains($unit, ':')
            ? ['sudo -n supervisorctl restart '.escapeshellarg($unit)]
            : ['sudo -n supervisorctl restart '.escapeshellarg($unit), 'sudo -n systemctl restart '.escapeshellarg($unit)];
        $out = '';
        foreach ($cmds as $cmd) {
            $o = [];
            $code = 1;
            @exec($cmd.' 2>&1', $o, $code);
            $out = implode("\n", $o);
            if ($code === 0) {
                return [true, $out];
            }
        }

        return [false, $out];
    }
}
