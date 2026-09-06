<?php

namespace App\Console\Commands;

use App\Jobs\QueueHeartbeatJob;
use App\Services\GnuBg\GnuBgClient;
use App\Services\MoveValidatorService;
use App\Support\Alert;
use App\Support\Backgammon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * ÇALIŞAN TÜM SERVİSLERİ izler (cron: dakikada bir). Her servis için: sağlık ölç -> düşükse
 * OTOMATİK yeniden başlatmayı DENE -> tekrar ölç -> hâlâ düşükse e-posta + WhatsApp UYARI
 * (Alert::transition, spam-önleyici). Servisler: Node validator, gnubg analiz, queue worker,
 * veritabanı. Sistemde aksama yaratabilecek her aşama buradan alarma bağlı.
 */
class ServicesWatch extends Command
{
    protected $signature = 'services:watch {--test : Kanalları doğrulamak için test uyarısı gönder}';

    protected $description = 'Tüm servisleri izle; düşerse yeniden başlat, kalıcıysa email+WhatsApp uyar';

    public function handle(MoveValidatorService $validator, GnuBgClient $gnubg): int
    {
        if ($this->option('test')) {
            Alert::send('🧪 TavlaTV TEST — servis izleme kanalları (e-posta + WhatsApp) çalışıyor. (Bu bir testtir.)');
            $this->info('Test uyarısı gönderildi.');

            return self::SUCCESS;
        }

        $services = [];

        // 1) Node validator (sunucu-otoriter maç hakemi) — yapılandırılmışsa.
        if ($validator->isConfigured()) {
            $services[] = [
                'key' => 'validator', 'name' => 'Validator (maç hakemi)',
                'probe' => fn () => $this->probeValidator($validator),
                'recover' => function () use ($validator) {
                    $r = $validator->restartValidator();

                    return ! empty($r['ok']);
                },
                'down' => "🔴 VALIDATOR DÜŞTÜ — sunucu-otoriter maçlarda hamleler REDDEDİLİYOR. Admin panel > Servis Durumu > Yeniden Başlat.",
                'up' => "🟢 VALIDATOR tekrar ÇALIŞIYOR.",
            ];
        }

        // 2) gnubg analiz servisi (PR + native luck) — URL ayarlıysa.
        if ((string) config('gnubg.url', '') !== '') {
            $services[] = [
                'key' => 'gnubg', 'name' => 'gnubg analiz servisi',
                'probe' => fn () => $gnubg->health(),
                'recover' => fn () => $this->systemctlRestart('gnubg-analysis'),
                'down' => "🔴 gnubg ANALİZ SERVİSİ DÜŞTÜ — PR + Şans (luck) hesaplanamıyor. `systemctl restart gnubg-analysis`.",
                'up' => "🟢 gnubg analiz servisi tekrar ÇALIŞIYOR.",
            ];
        }

        // 3) Queue worker (shadow PR + gnubg luck işçisi).
        $services[] = [
            'key' => 'queue', 'name' => 'Queue worker',
            'probe' => fn () => $this->probeQueue(),
            'recover' => fn () => $this->systemctlRestart('tavla-queue'),
            'down' => "🔴 QUEUE WORKER DÜŞTÜ — arka plan işleri (PR/Şans analizi) birikiyor. `systemctl restart tavla-queue`.",
            'up' => "🟢 Queue worker tekrar ÇALIŞIYOR.",
        ];

        // 4) Veritabanı — OTOMATİK RESTART YOK (riskli); yalnız uyarı.
        $services[] = [
            'key' => 'database', 'name' => 'Veritabanı',
            'probe' => fn () => $this->probeDatabase(),
            'recover' => null,
            'down' => "🔴 VERİTABANI ERİŞİLEMİYOR — site büyük ölçüde çalışmaz. ACİL: DB sunucusunu kontrol et.",
            'up' => "🟢 Veritabanı tekrar erişilebilir.",
        ];

        foreach ($services as $svc) {
            $up = (bool) $svc['probe']();
            $recovered = false;
            if (! $up && ! empty($svc['recover'])) {
                try {
                    if ($svc['recover']()) {
                        $recovered = true;
                        sleep(3); // canlanması için kısa bekleme
                        $up = (bool) $svc['probe']();
                    }
                } catch (\Throwable $e) {
                    // recover patlarsa yok say -> uyarı yine gider
                }
            }
            $downMsg = $svc['down'].($recovered && ! $up ? "\n(Otomatik yeniden başlatma denendi, düzelmedi.)" : '');
            $result = Alert::transition($svc['key'], ! $up, $downMsg, $svc['up']);

            $tag = $up ? '<info>UP</info>' : '<error>DOWN</error>';
            $this->line(sprintf('%-26s %s  [%s]', $svc['name'], strip_tags($tag), $result));
            if ($up) {
                $this->info("  {$svc['name']}: UP".($recovered ? ' (otomatik kurtarıldı)' : ''));
            } else {
                $this->error("  {$svc['name']}: DOWN ({$result})");
            }
        }

        return self::SUCCESS;
    }

    private function probeValidator(MoveValidatorService $validator): bool
    {
        try {
            $s = Backgammon::initialState();
            $s['dice'] = [3, 1];
            $s['diceUsed'] = [false, false];
            $r = $validator->validate($s, [
                ['from' => 5, 'to' => 2, 'die' => 3],
                ['from' => 2, 'to' => 1, 'die' => 1],
            ]);

            return (bool) ($r['valid'] ?? false) && empty($r['unreachable']);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** Queue: worker canlılığı. Bekleyen en eski iş >180sn ise worker consume ETMİYOR = DOWN. Ayrıca
     *  her çağrıda bir heartbeat job dispatch et (worker'a tüketilecek iş + widget nabzı). */
    private function probeQueue(): bool
    {
        try {
            // 1) NABIZ tazeliği: worker QueueHeartbeatJob'ı işlediğinde cache'e zaman yazar. Bayatsa
            //    (>180sn) worker İŞLEMİYOR — boştayken (backlog yokken) bile ölü worker'ı yakalar.
            $hb = Cache::get('queue:heartbeat');
            $hbStale = $hb !== null && (time() - (int) $hb) > 180;
            // 2) BACKLOG: bekleyen en eski iş >180sn = worker consume etmiyor (nabız da burada birikir).
            $oldest = DB::table('jobs')->min('available_at');
            $backlog = $oldest && (time() - (int) $oldest) > 180;
            // Sonraki tur için nabız bırak (worker up ise hızlıca tüketir + cache tazeler; down ise birikir).
            try {
                QueueHeartbeatJob::dispatch()->onConnection('database');
            } catch (\Throwable $e) {
                // dispatch edemezsek (DB?) queue zaten sorunlu; database probe yakalar
            }

            return ! ($hbStale || $backlog);
        } catch (\Throwable $e) {
            return false; // jobs tablosu okunamıyor -> DB sorunu (database probe da uyarır)
        }
    }

    private function probeDatabase(): bool
    {
        try {
            DB::select('select 1');

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** systemd birimini best-effort yeniden başlat (sudo -n; izin yoksa systemd Restart=always'a güven). */
    private function systemctlRestart(string $unit): bool
    {
        if (! function_exists('exec')) {
            return false; // exec kapalı (paylaşımlı hosting) -> systemd Restart=always devrede
        }
        $out = [];
        $code = 1;
        @exec('sudo -n systemctl restart '.escapeshellarg($unit).' 2>&1', $out, $code);

        return $code === 0;
    }
}
