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
                    // Altyapı.
                    $this->checkDatabase() + ['group' => 'Altyapı'],
                    $this->checkQueue() + ['group' => 'Altyapı'],
                    $this->checkScheduler() + ['group' => 'Altyapı'],
                    $this->checkDisk() + ['group' => 'Altyapı'],
                ],
                'validator_required' => (bool) config('validator.required', true),
            ];
        });

        return [
            'services' => $data['services'],
            'validator_required' => $data['validator_required'],
            'authoritative' => (bool) config('game.server_authoritative', false),
            'pr_mode' => (string) config('validator.pr_mode', 'off'),
            'gnubg_pr_mode' => (string) config('gnubg.pr_mode', 'off'),
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
            $rows[] = $this->svc('gnubgp-'.$port, $label, true, $up, $detail, $unit !== null) + ['group' => $group];
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
     * Queue worker (shadow PR + gnubg luck işçisi). CANLILIK: worker her döngüde 'queue:worker:heartbeat'
     * cache'ine zaman damgası bırakır (AppServiceProvider Queue::looping). Heartbeat taze (<60sn) ise
     * worker AYAKTA -> yüzlerce iş birikse (backfill) bile YEŞİL (yığını eritiyor). Heartbeat yok/eski
     * ise ESKİ proxy'ye düş: en eski bekleyen iş > 90sn -> worker muhtemelen KAPALI (kırmızı).
     */
    private function checkQueue(): array
    {
        try {
            $pending = (int) DB::table('jobs')->count();
            $failed = 0;
            try {
                $failed = (int) DB::table('failed_jobs')->count();
            } catch (\Throwable $e) {
                // failed_jobs yoksa yok say
            }

            // Süreç canlılık damgası (backlog'tan bağımsız KESIN sinyal).
            $hb = (int) (Cache::get('queue:worker:heartbeat') ?? 0);
            $alive = $hb > 0 && (time() - $hb) < 60;

            if ($pending === 0) {
                $detail = 'Boşta (bekleyen iş yok'.($failed > 0 ? ", $failed başarısız" : '').')';
                // heartbeat taze -> canlı-boşta (yeşil); yoksa ayırt edilemez (gri).
                return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, $alive ? true : null, $detail, true);
            }
            $oldest = DB::table('jobs')->min('available_at');
            $age = $oldest ? (time() - (int) $oldest) : 0;
            // Heartbeat taze -> worker çalışıyor (backlog erimekte); değilse eski proxy (>90sn = kapalı).
            $up = $alive ? true : ($age < 90);
            $detail = "$pending iş bekliyor, en eski {$age}sn".($failed > 0 ? " · $failed başarısız" : '');
            if ($alive && $age >= 90) {
                $detail .= ' — işleniyor (worker canlı, yığın eriyor)';
            } elseif (! $up) {
                $detail .= ' — birikmiş (worker kapalı olabilir)';
            }

            return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, $up, $detail, true);
        } catch (\Throwable $e) {
            return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, false, 'jobs tablosu okunamadı', true);
        }
    }

    /**
     * İNSAN-vs-İNSAN maçları (Tek Oyun · Maç Oyunu · Arkadaşınla Oyna): YALNIZ validator'a bağlı
     * (hamle yasallığı hakemi). gnubg KULLANMAZ -> analiz servisleri tamamen düşse bile insan
     * maçları oynanır. Bu satır oyuncu-vs-oyuncu akışının canlılığını tek bakışta gösterir.
     */
    private function checkHumanMatches(bool $vUp, int $vCount): array
    {
        $detail = $vUp
            ? "Oynanabilir — hakem (validator) ayakta. gnubg gerekmez; analiz servisleri düşse bile etkilenmez."
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

        // gnubgp-{port} -> port→systemd birimi (rol-gruplu yeni panel). Eski 'gnubg'/'gnubg-N' de desteklenir.
        $unit = null;
        if (str_starts_with($key, 'gnubgp-')) {
            $port = (int) substr($key, strlen('gnubgp-'));
            $units = app(GnuBgClient::class)->unitNames();
            $unit = $this->unitForPort($port, $units);
            if (! $unit) {
                Notification::make()->title('Bu instance için birim adı tanımlı değil')
                    ->body('GNUBG_UNITS env\'ine :'.$port.' portunun systemd birim adını ekle. SSH: systemctl restart <birim>.')
                    ->warning()->persistent()->send();

                return;
            }
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

    /** systemd birimini best-effort yeniden başlat (sudo -n; izin yoksa false + çıktı). */
    private function systemctlRestart(string $unit): array
    {
        if (! function_exists('exec')) {
            return [false, 'exec kapalı (paylaşımlı hosting)'];
        }
        $o = [];
        $code = 1;
        @exec('sudo -n systemctl restart '.escapeshellarg($unit).' 2>&1', $o, $code);

        return [$code === 0, implode("\n", $o)];
    }
}
