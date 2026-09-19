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
            $vres = $this->checkValidators();
            $gnubg = $this->checkGnubg();

            return [
                'services' => [
                    ...$vres['rows'], // birincil + yedek validator(lar) AYRI lamba
                    $gnubg,
                    // Türetilmiş: sunucu-otoriter bot maçı oynatılabilir mi (gnubg + EN AZ BİR validator).
                    $this->checkBot($vres['up'], $gnubg),
                    $this->checkDatabase(),
                    $this->checkQueue(),
                    // İzleyiciyi izler: cron durursa TÜM izleme/alarm ölür -> bunu görünür kıl.
                    $this->checkScheduler(),
                    $this->checkDisk(),
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
            // Restart butonu yalnız BİRİNCİL satırda (restartValidator() zaten TÜM tabanlara /restart yollar).
            $rows[] = $this->svc('validator'.($i === 0 ? '' : '-'.$i), $label, true, $up, $base, $i === 0);
        }

        return ['rows' => $rows, 'up' => $anyUp];
    }

    /** gnubg analiz servisi (PR + native luck kaynağı): /health. */
    private function checkGnubg(): array
    {
        $url = (string) config('gnubg.url', '');
        if ($url === '') {
            return $this->svc('gnubg', 'TavlaTV Analiz Servisi', false, null, 'GNUBG_URL boş');
        }
        try {
            $up = app(GnuBgClient::class)->health();
            // KIRMIZIYSA nedenini teşhis et (bugünkü symlink/dosya sorunu gibi) -> SSH'a girmeden anla.
            $detail = $up ? $url : $url.' — '.$this->gnubgDownReason();

            return $this->svc('gnubg', 'TavlaTV Analiz Servisi', true, $up, $detail, true);
        } catch (\Throwable $e) {
            return $this->svc('gnubg', 'TavlaTV Analiz Servisi', true, false, 'İstisna: '.$e->getMessage(), true);
        }
    }

    /** gnubg KIRMIZIyken nedenini teşhis et: symlink kırık / dosya yok / servis kapalı. */
    private function gnubgDownReason(): string
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

        return 'servis kapalı — SSH: systemctl restart gnubg-analysis (durum: systemctl status gnubg-analysis)';
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

    /** Bot (PvB) hazır mı: sunucu-otoriter bot maçı gnubg + validator gerektirir (ikisi de UP). */
    private function checkBot(bool $vUp, array $gnubg): array
    {
        $gUp = ($gnubg['up'] ?? null) === true;
        $up = $vUp && $gUp;
        $need = [];
        if (! $gUp) {
            $need[] = 'analiz servisi (gnubg)';
        }
        if (! $vUp) {
            $need[] = 'validator';
        }
        $detail = $up
            ? 'Sunucu-otoriter bot maçı oynatılabilir'
            : 'Oynatılamaz — gerekli: '.implode(' + ', $need);

        return $this->svc('bot', 'Bot Maçı (PvB)', true, $up, $detail);
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

        $unit = $key === 'gnubg' ? 'gnubg-analysis' : ($key === 'queue' ? 'tavla-queue' : null);
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
