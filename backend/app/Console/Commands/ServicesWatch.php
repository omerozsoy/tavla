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
                'down' => '🔴 VALIDATOR DÜŞTÜ — sunucu-otoriter maçlarda hamleler REDDEDİLİYOR. Admin panel > Servis Durumu > Yeniden Başlat.',
                'up' => '🟢 VALIDATOR tekrar ÇALIŞIYOR.',
            ];
        }

        // 2) gnubg analiz instance'ları (PR + native luck) — birincil + yedek(ler) AYRI izlenir. Her biri
        //    düşerse KENDİ systemd birimiyle restart + ayrı alarm. Böylece 4 instance'ın herhangi biri
        //    düşse anında kurtarılır -> failover havuzu erimez -> PR asla boş kalmaz.
        $bases = $gnubg->analyzeBases();
        $units = $gnubg->unitNames();
        foreach ($bases as $i => $base) {
            $unit = $units[$i] ?? null;
            $label = $i === 0 ? 'gnubg analiz (birincil)' : 'gnubg analiz (yedek #'.$i.')';
            $services[] = [
                'key' => 'gnubg'.($i === 0 ? '' : '-'.$i), 'name' => $label,
                'probe' => fn () => $gnubg->probeBase($base),
                'recover' => $unit ? fn () => $this->systemctlRestart($unit) : null,
                'down' => "🔴 {$label} DÜŞTÜ ({$base}) — ".($unit ? "`systemctl restart {$unit}`." : 'systemd birimi tanımsız (GNUBG_UNITS).')
                    .' Diğer instance\'lar ayaktaysa PR failover ile çalışmaya devam eder.',
                'up' => "🟢 {$label} tekrar ÇALIŞIYOR ({$base}).",
            ];
        }

        // 2b) DEDİKE AĞIR ANALİZ instance'ları (GNUBG_HEAVY_URLS — matchluck/reviewmatch/analyzematch).
        //     KRİTİK: /health probe'u YETMEZ. gnubg 'analyse match' yolunda SEGV atınca (matchluck
        //     self-play) HTTP sunucusu /health'e HÂLÂ 200 döner ama motor ölüdür -> crash-loop (her
        //     matchluck SIGSEGV; 2026-10-10'da 8098 ~4000 kez çöküp kalktı, 7 saat sessiz kaldı çünkü
        //     /health yeşildi + heavy havuz analyzeBases'te YOKtu). Bu yüzden GERÇEK motor probe'u
        //     (matchluck selftest) kullan -> SEGV'i yakalar. analyzeBases'te zaten izlenenleri atla.
        // OPT-IN (varsayılan KAPALI): heavy probe matchluck selftest ATAR -> instance SEGV atıyorsa
        // probe'un KENDİSİ onu çökertir + her instance için alarm yağar (2026-10-11 olayı: 8098-8101
        // SEGV crash-loop'ta iken e-posta seli). Motor sağlıkken açmak güvenli; GNUBG_WATCH_HEAVY=1.
        $watched = env('GNUBG_WATCH_HEAVY', false) ? array_flip($bases) : null;
        foreach (($watched === null ? [] : $gnubg->heavyOnlyBases()) as $base) {
            if (isset($watched[$base])) {
                continue; // zaten foreground/background olarak izleniyor (çift alarm yok)
            }
            $port = (int) parse_url($base, PHP_URL_PORT);
            $unit = $gnubg->unitForPort($port);
            $services[] = [
                'key' => 'gnubg-heavy-'.$port, 'name' => 'gnubg ağır analiz (:'.$port.')',
                // Heavy matchluck self-play SEGV'i veri-bağımlı + geçici olabilir (anlık yüklü motoru
                // probe'un KENDİSİ çökertebilir) ve Şans failover'a düşer -> maç sonuçları etkilenmez.
                // Bu yüzden daha yüksek strike eşiği: kendini iyileştiren olaylar page atmadan geçsin.
                'strikes' => (int) env('GNUBG_HEAVY_FAIL_STRIKES', 3),
                'probe' => fn () => $gnubg->probeHeavyEngine($base),
                'recover' => $unit ? fn () => $this->systemctlRestart($unit) : null,
                'down' => "🔴 gnubg AĞIR ANALİZ MOTORU DÜŞTÜ ({$base}) — matchluck/analiz SEGV (crash-loop olabilir; "
                    ."restart düzeltmezse gnubg sürümünü/weights'i incele). ".($unit ? "`systemctl restart {$unit}`." : 'GNUBG_UNITS\'e birim ekle.')
                    .' Şans (Luck) failover ile arka plan havuzuna düşer; maç sonuçları etkilenmez.',
                'up' => "🟢 gnubg ağır analiz motoru ({$base}) tekrar ÇALIŞIYOR.",
            ];
        }

        // 3) Queue worker (shadow PR + gnubg luck işçisi).
        $services[] = [
            'key' => 'queue', 'name' => 'Queue worker',
            'probe' => fn () => $this->probeQueue(),
            'recover' => fn () => $this->systemctlRestart('tavla-queue'),
            'down' => '🔴 QUEUE WORKER DÜŞTÜ — arka plan işleri (PR/Şans analizi) birikiyor. `systemctl restart tavla-queue`.',
            'up' => '🟢 Queue worker tekrar ÇALIŞIYOR.',
        ];

        // 4) Veritabanı — OTOMATİK RESTART YOK (riskli); yalnız uyarı.
        $services[] = [
            'key' => 'database', 'name' => 'Veritabanı',
            'probe' => fn () => $this->probeDatabase(),
            'recover' => null,
            'down' => '🔴 VERİTABANI ERİŞİLEMİYOR — site büyük ölçüde çalışmaz. ACİL: DB sunucusunu kontrol et.',
            'up' => '🟢 Veritabanı tekrar erişilebilir.',
        ];

        // 5) Redis — cache (DB1) + session (DB0) buradan tutulur; düşerse login+cache çöker. OTOMATİK
        //    RESTART YOK: systemd `Restart=always` zaten kaldırır + redis-server için sudo -n izni yok
        //    (NOPASSWD yalnız supervisorctl/fpm/nginx). Yalnız uyarı. Probe socket üzerinden ping.
        //    NOT: cache=redis olduğundan redis TAM down ise bu komutun kendi Cache çağrıları da patlar;
        //    probe try/catch'li, en kötü ihtimalle komut log'a hata düşer ama DOWN tespiti yapılır.
        $services[] = [
            'key' => 'redis', 'name' => 'Redis (cache + session)',
            'probe' => fn () => $this->probeRedis(),
            'recover' => null,
            'down' => '🔴 REDIS ERİŞİLEMİYOR — cache + oturumlar çalışmaz (girişler düşer, site yavaşlar). '
                .'ACİL: `systemctl restart redis-server` + `redis-cli -s /run/redis/redis.sock ping`.',
            'up' => '🟢 Redis tekrar erişilebilir.',
        ];

        // DE-FLAP (2026-10-11 SAHTE "düştü" KÖK ÇÖZÜM): TEK bir geçici probe ıskası ALARM VERMEZ.
        // gnubg instance'ı PR patlamasında (peak_inflight=35) meşgulken 5sn'lik /health probe'u bir tur
        // ıskalayabilir (accept-backlog); süreç sağlamdır. Üst üste 2 tur (≈2 dk) down ise GERÇEK düşüş
        // say -> ancak o zaman restart + alarm. Ayrıca restart'ı da 2. ıskaya ERTELE: sağlam-ama-meşgul
        // instance ilk ıskada gereksiz yeniden başlatılıp uçuştaki PR analizini kesmesin.
        $threshold = (int) env('SERVICES_WATCH_FAIL_STRIKES', 2);
        foreach ($services as $svc) {
            $svcThreshold = $svc['strikes'] ?? $threshold; // heavy gnubg kendi (daha yüksek) eşiğini verir
            $failKey = 'svcwatch:fails:'.$svc['key'];
            $up = (bool) $svc['probe']();
            $recovered = false;

            if ($up) {
                Cache::forget($failKey);
                $result = Alert::transition($svc['key'], false, '', $svc['up']);
            } else {
                $fails = (int) Cache::get($failKey, 0) + 1;
                Cache::put($failKey, $fails, 3600);
                if ($fails < $svcThreshold) {
                    // İlk ıska(lar): geçici olabilir -> bekle, restart YOK, alarm YOK, state DEĞİŞMEZ.
                    $result = "flap-hold ({$fails}/{$svcThreshold})";
                } else {
                    // Eşik aşıldı: GERÇEK düşüş. Restart dene -> yeniden ölç -> hâlâ down ise alarm.
                    if (! empty($svc['recover'])) {
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
                    if ($up) {
                        Cache::forget($failKey);
                        $result = Alert::transition($svc['key'], false, '', $svc['up']);
                    } else {
                        $downMsg = $svc['down'].($recovered ? "\n(Otomatik yeniden başlatma denendi, düzelmedi.)" : '');
                        $result = Alert::transition($svc['key'], true, $downMsg, $svc['up']);
                    }
                }
            }

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
            //    SADECE 'default' kuyruğu: bu alarm/restart tavla-queue'ya (--queue=default) aittir.
            //    Filtresiz min() reviews/bulk/warm gibi AYRI worker'ların birikimini yakalayıp sahte
            //    "QUEUE WORKER DÜŞTÜ" üretiyordu (restart default'u canlandırır ama başka kuyruğu temizlemez
            //    -> sonsuz flap). Her kuyruk kendi worker'ı tarafından ayrı izlenir.
            $oldest = DB::table('jobs')->where('queue', 'default')->min('available_at');
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

    /** Redis canlı mı: socket/TCP üzerinden PING. phpredis true, bazı sürümler 'PONG'/'+PONG' döner. */
    private function probeRedis(): bool
    {
        try {
            $r = app('redis')->connection()->ping();

            return $r === true || (is_string($r) && stripos($r, 'PONG') !== false);
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
