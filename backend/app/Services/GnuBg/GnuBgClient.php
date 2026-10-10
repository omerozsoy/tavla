<?php

namespace App\Services\GnuBg;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * gnubg analiz servisine (gnubg-service) HTTP istemcisi. GNU-only analiz mimarisinde
 * TEK gnubg giris noktasi — gnubg'ye ozgu her sey serviste kalir; burasi sadece HTTP.
 *
 * Yapisal konum formati (backend'in gonderdigi kanonik konum):
 *   points: 24 isaretli int (beyaz +, siyah -), bar{white,black}, off{white,black},
 *   turn: 'white'|'black', dice: [d1,d2] (checker) veya [] (cube), cube{value,owner},
 *   score{white,black}, matchLength (0=para oyunu), crawford: bool, plies: int (0 fast/2 deep).
 */
class GnuBgClient
{
    public function health(): bool
    {
        try {
            return Http::timeout(5)->get($this->url('/health'))->ok();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * ÖN PLAN (CANLI BOT) instance havuzu: GNUBG_URL + GNUBG_URL_BACKUP, sırayla. Maç sırasında botun
     * hamlesi bu havuzdan hesaplanır -> arka plan PR/heal analiziyle ÇAKIŞMAZ ("onayla" takılmaz).
     */
    public function foregroundBases(): array
    {
        $primary = rtrim((string) config('gnubg.url', 'http://127.0.0.1:8092'), '/');
        $backups = array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.url_backup', '')),
        );

        return array_values(array_filter(array_merge([$primary], $backups), fn ($u) => $u !== ''));
    }

    /** ARKA PLAN (PR/heal) instance havuzu: GNUBG_ANALYSIS_URLS. Boşsa [] -> izolasyon yok (ön plan kullanılır). */
    public function backgroundBases(): array
    {
        return array_values(array_filter(array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.analysis_urls', '')),
        ), fn ($u) => $u !== ''));
    }

    /**
     * AĞIR analiz (reviewmatch/analyzematch/matchluck) taban listesi: dedike heavy havuzu (GNUBG_HEAVY_URLS)
     * YÜK-DENGELİ (shuffle), sonra SON ÇARE arka plan havuzu (PR/heal) fallback. heavy_urls boşsa tekil
     * heavy_url'e (o da boşsa url'e) düşer -> geriye dönük uyum. Canlı foreground (bot) listede DEĞİL ->
     * ağır analiz botu ASLA bloklamaz. Shuffle sayesinde eşzamanlı iki review farklı heavy instance'ına düşer.
     */
    public function heavyBases(): array
    {
        $pool = array_values(array_filter(array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.heavy_urls', '')),
        ), fn ($u) => $u !== ''));
        if ($pool === []) {
            $pool = [rtrim((string) config('gnubg.heavy_url') ?: (string) config('gnubg.url', 'http://127.0.0.1:8092'), '/')];
        }
        if (count($pool) > 1) {
            shuffle($pool);
        }

        return array_values(array_unique(array_merge($pool, $this->backgroundBases())));
    }

    /**
     * TÜM instance'lar (ön plan + arka plan, dedup, sıra korunur). Admin "Servis Durumu" paneli +
     * services:watch her instance'ı ayrı gösterir/izler + analyzeHealthy any-up kontrolü. Tek eleman ->
     * eski tek-instance davranışı (geriye dönük uyum).
     */
    public function analyzeBases(): array
    {
        return array_values(array_unique(array_merge($this->foregroundBases(), $this->backgroundBases())));
    }

    /** Instance→systemd birim adları (bases ile hizalı). config('gnubg.units') virgüllü. */
    public function unitNames(): array
    {
        return array_values(array_filter(array_map(
            fn ($u) => trim((string) $u),
            explode(',', (string) config('gnubg.units', 'gnubg-analysis')),
        ), fn ($u) => $u !== ''));
    }

    /** TEK bir tabanı DOĞRUDAN yokla (failover'sız): panelde her instance'ın ayrı lambası için. */
    public function probeBase(string $base): bool
    {
        try {
            return Http::timeout(5)->get(rtrim($base, '/').'/health')->ok();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * YALNIZ yapılandırılmış DEDİKE ağır analiz instance'ları (GNUBG_HEAVY_URLS, boşsa heavy_url).
     * background fallback + shuffle YOK — services:watch her ağır instance'ı KENDİ portu/birimiyle ayrı
     * izlesin diye (heavyBases() izleme için uygun değil: arka plan havuzunu katar + sırayı karıştırır).
     */
    public function heavyOnlyBases(): array
    {
        $pool = array_values(array_filter(array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.heavy_urls', '')),
        ), fn ($u) => $u !== ''));
        if ($pool === []) {
            $h = rtrim((string) config('gnubg.heavy_url'), '/');
            if ($h !== '') {
                $pool = [$h];
            }
        }

        return array_values(array_unique($pool));
    }

    /**
     * Belirli ağır instance'ın ANALİZ MOTORU gerçekten çalışıyor mu? KRİTİK: /health YETMEZ — gnubg
     * 'analyse match' yolunda SEGV atınca (matchluck/self-play) HTTP sunucusu /health'e HÂLÂ 200
     * döner ama motor ölüdür (crash-loop: her matchluck isteği SIGSEGV). Bu yüzden GERÇEK matchluck
     * selftest (kısa self-play -> analyse -> parse) ile motoru yoklarız; p0/p1 luck dönerse UP.
     */
    public function probeHeavyEngine(string $base): bool
    {
        try {
            $resp = Http::timeout(30)
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post(rtrim($base, '/').'/matchluck', ['mat' => null, 'selftest' => true]);
            if (! $resp->ok()) {
                return false;
            }
            $luck = $resp->json('luck');

            return is_array($luck) && isset($luck['p0'], $luck['p1']);
        } catch (\Throwable $e) {
            return false; // Empty reply / cURL 52 (SEGV) / erişilemez -> DOWN
        }
    }

    /**
     * Port -> systemd birim adı (konvansiyon: 8092=gnubg-analysis, 8093=gnubg-analysis-heavy,
     * 8091+N=gnubg-analysis-N). Yalnız GNUBG_UNITS listesinde GERÇEKTEN varsa döner (restart edilebilir);
     * yoksa null -> services:watch yalnız alarm verir, körlemesine restart denemez.
     */
    public function unitForPort(int $port): ?string
    {
        if ($port <= 0) {
            return null;
        }
        $guess = match ($port) {
            8092 => 'gnubg-analysis',
            8093 => 'gnubg-analysis-heavy',
            default => 'gnubg-analysis-'.($port - 8091),
        };

        return in_array($guess, $this->unitNames(), true) ? $guess : null;
    }

    /** Belirli bir tabanın /health JSON'u (inflight/peak ölçümü için) veya null. */
    public function healthInfoAt(string $base): ?array
    {
        try {
            $resp = Http::timeout(5)->get(rtrim($base, '/').'/health');

            return $resp->ok() ? $resp->json() : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * /analyze yapabilecek EN AZ BİR instance ayakta mı? (Herhangi biri health=ok -> true.) PR job
     * precheck'i + heal komutu bunu kullanır: birincil down olsa bile yedek ayaktaysa PR hesaplanabilir,
     * dolayısıyla job'u boşuna ertelemeyiz. Hiçbiri ayakta değilse false -> job fırlatır (retry).
     */
    public function analyzeHealthy(): bool
    {
        foreach ($this->analyzeBases() as $base) {
            try {
                if (Http::timeout(5)->get($base.'/health')->ok()) {
                    return true;
                }
            } catch (\Throwable $e) {
                // bu taban erişilemez -> sıradaki yedeği yokla
            }
        }

        return false;
    }

    /**
     * /health JSON'u (ölçüm için): ['ok','service','version','inflight','peak_inflight'] veya null.
     * peak_inflight = gözlemlenen en çok eşzamanlı analiz — çok-süreçli gnubg havuzu gerekli mi
     * kararı için (hep 1 -> gereksiz; sık 2+ -> darboğaz). Admin Servis Durumu paneli gösterir.
     */
    public function healthInfo(): ?array
    {
        try {
            $resp = Http::timeout(5)->get($this->url('/health'));

            return $resp->ok() ? $resp->json() : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Yapisal konumu analiz et. Doner: ['gnubgid'=>..., 'result'=>gnubg.hint()] veya null.
     * gnubg.hint().hint[] = adaylar: {move, equity(cubeful/EMG), eqdiff(kayip), details.probs}.
     */
    public function analyze(array $position): ?array
    {
        // ÖN PLAN (CANLI BOT): ön plan havuzunu yük-dengeli (shuffle) + failover kullanır. Maç sırasında
        // botun hamlesi buradan hesaplanır. Ön plan tümü düşükse arka plan havuzuna düşer (redundans ->
        // oyun durmaz). Arka plan PR/heal AYRI havuzda olduğundan "onayla" heal yükünün ARKASINDA BEKLEMEZ.
        $fg = $this->foregroundBases();
        if (count($fg) > 1) {
            shuffle($fg);
        }
        $fallback = array_values(array_diff($this->backgroundBases(), $fg));

        return $this->tryAnalyze(array_merge($fg, $fallback), $position);
    }

    /**
     * ARKA PLAN analiz (PR/heal): arka plan havuzunu (GNUBG_ANALYSIS_URLS) yük-dengeli + failover kullanır
     * ki CANLI botun ön plan instance'larını MEŞGUL ETMESİN (maç sırasında "onayla" takılmasın). Arka plan
     * havuzu tanımsızsa ön planı kullanır (izolasyon yok = geriye dönük). Arka plan tümü düşükse ön plana
     * düşer (PR yine hesaplanır). AnalysisOrchestrator (checkerPr/cubePr) BUNU kullanır.
     */
    public function analyzeBackground(array $position): ?array
    {
        $bg = $this->backgroundBases();
        if ($bg === []) {
            $bg = $this->foregroundBases(); // izolasyon yapılandırılmamış -> ön planı kullan
        }
        if (count($bg) > 1) {
            shuffle($bg);
        }
        $fallback = array_values(array_diff($this->foregroundBases(), $bg));

        return $this->tryAnalyze(array_merge($bg, $fallback), $position);
    }

    /**
     * TOPLU ARKA PLAN analiz (PR HIZLANDIRMA): N pozisyonu arka plan havuzuna PARALEL dağıtır.
     * Eskiden AnalysisOrchestrator her kararı SIRAYLA analyzeBackground() ile çağırıyordu -> tek maçın
     * ~60 kararı tek instance'ta arka arkaya (~0.25sn × 60 ≈ 15sn). Burada tüm kararları Http::pool ile
     * AYNI ANDA, round-robin ile havuzdaki instance'lara dağıtırız -> gnubg'ler paralel çalışır
     * (her biri tek-thread, kendi kuyruğunu sıralı işler) -> ~ceil(N / instance) tur ≈ 6 instance'ta ~6×.
     * Dönüş: GİRİŞLE AYNI anahtarlı dizi; her biri analyze JSON'u ya da null. Başarısız/boş yanıtlar
     * SIRAYLA failover ile (analyzeBackground) telafi edilir (nadir; instance down). PR matematiği
     * DEĞİŞMEZ — yalnız çağrılar paralelleşir.
     *
     * @param  array<int|string,array>  $positions
     * @return array<int|string,?array>
     */
    public function analyzeBackgroundBatch(array $positions): array
    {
        if ($positions === []) {
            return [];
        }
        $bg = $this->backgroundBases();
        if ($bg === []) {
            $bg = $this->foregroundBases(); // izolasyon yapılandırılmamış -> ön planı kullan
        }
        if ($bg === []) {
            // hiç instance yok -> tekil sıralı (geriye dönük)
            $out = [];
            foreach ($positions as $k => $p) {
                $out[$k] = $this->analyzeBackground($p);
            }

            return $out;
        }

        $n = count($bg);
        $secret = (string) config('gnubg.secret');
        $timeout = (int) config('gnubg.timeout', 20);

        // Tüm istekleri AYNI ANDA aç (curl_multi); her biri round-robin bir instance'a gider.
        $responses = Http::pool(function ($pool) use ($positions, $bg, $n, $secret, $timeout) {
            $i = 0;
            foreach ($positions as $k => $p) {
                $base = rtrim($bg[$i % $n], '/');
                $i++;
                $pool->as((string) $k)
                    ->timeout($timeout)
                    ->withHeaders(['x-gnubg-secret' => $secret])
                    ->acceptJson()
                    ->post($base.'/analyze', $p);
            }
        });

        $out = [];
        $failed = [];
        foreach ($positions as $k => $p) {
            $resp = $responses[(string) $k] ?? null;
            try {
                if ($resp instanceof \Illuminate\Http\Client\Response && $resp->ok()) {
                    $out[$k] = $resp->json();

                    continue;
                }
            } catch (\Throwable $e) {
                // düş -> failover
            }
            $out[$k] = null;
            $failed[$k] = $p; // havuz denemesi başarısız -> sıralı failover ile telafi
        }
        if ($failed !== []) {
            Log::warning('gnubg batch: '.count($failed).'/'.count($positions).' pozisyon havuzda basarisiz, sirali failover');
            foreach ($failed as $k => $p) {
                $out[$k] = $this->analyzeBackground($p);
            }
        }

        return $out;
    }

    /** Verilen tabanları SIRAYLA /analyze dener, ilk 2xx'i döndürür; hepsi düşükse null (failover). */
    private function tryAnalyze(array $bases, array $position): ?array
    {
        $last = count($bases) - 1;
        foreach ($bases as $i => $base) {
            try {
                $resp = Http::timeout((int) config('gnubg.timeout', 20))
                    ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                    ->acceptJson()
                    ->post($base.'/analyze', $position);
                if ($resp->ok()) {
                    return $resp->json();
                }
                Log::warning('gnubg analyze non-ok', ['idx' => $i, 'base' => $base, 'status' => $resp->status()]);
            } catch (\Throwable $e) {
                Log::warning(
                    $i < $last ? 'gnubg analyze erisilemez, sonrakine geciliyor' : 'gnubg analyze erisilemez (tum instance dustu)',
                    ['idx' => $i, 'base' => $base, 'msg' => $e->getMessage()],
                );
            }
        }

        return null;
    }

    /**
     * Iki bot (gnubg) bir oyun oynar; BIZIM log formatinda karar listesi doner (test/uretim).
     * ['log'=>[...], 'winner'=>..., 'decisions'=>int] veya null.
     */
    public function selfplay(array $params = []): ?array
    {
        try {
            $resp = Http::timeout(180) // self-play ~60 hint -> uzun timeout
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/selfplay'), $params);
            if (! $resp->ok()) {
                Log::warning('gnubg selfplay non-ok', ['status' => $resp->status()]);

                return null;
            }

            return $resp->json();
        } catch (\Throwable $e) {
            Log::warning('gnubg selfplay exception', ['msg' => $e->getMessage()]);

            return null;
        }
    }

    /** KÜP teşhisi: pozisyonun gnubg cube analizini (farklı yollarla + hata detayı) döndürür. */
    public function cubetest(array $position): ?array
    {
        try {
            $resp = Http::timeout((int) config('gnubg.timeout', 20))
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/cubetest'), $position);

            return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['exception' => $e->getMessage()];
        }
    }

    /** ROLLOUT teşhisi: pozisyonun gnubg rollout çıktısını döndürür (rollout tırmanma tasarımı için). */
    public function rollouttest(array $position): ?array
    {
        try {
            $resp = Http::timeout(120) // rollout yavaş
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/rollouttest'), $position);

            return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['exception' => $e->getMessage()];
        }
    }

    /** LUCK teşhisi: gnubg native 'luck' çıktısını (istatistik metni + yapısal per-move) döndürür. */
    public function lucktest(int $pointsMatch = 1): ?array
    {
        try {
            $resp = Http::timeout(180) // oto-maç + analiz -> uzun
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/lucktest'), ['points_match' => $pointsMatch]);

            return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['exception' => $e->getMessage()];
        }
    }

    /**
     * .mat maçının gnubg NATIVE luck'ını döndürür (Tavlai Luck V1 kaynağı): per-oyuncu MWC% + EMG.
     * $mat null + selftest=true -> gnubg kendi maçını export/reimport eder (hat doğrulama).
     * Doner: ['luck'=>['names'=>[..], 'p0'=>['mwc_total'=>..], 'p1'=>..], 'import_cmd'=>..] veya hata.
     */
    public function matchluck(?string $mat = null, bool $selftest = false): ?array
    {
        // SELFTEST (admin diagnostik, tavla:gnubg-matchluck-test): TEK yapılandırılmış heavy'ye git —
        // failover ETME ki hangi instance'ın bozuk olduğu GİZLENMESİN (8098 SEGV'i sağlam yedeğe
        // düşüp "OK" görünmesin; teşhis bu testin doğrudan o instance'ı vurmasına dayanır).
        if ($selftest || $mat === null) {
            try {
                $resp = Http::timeout(180)
                    ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                    ->acceptJson()
                    ->post($this->heavyUrl('/matchluck'), ['mat' => $mat, 'selftest' => true]);

                return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
            } catch (\Throwable $e) {
                return ['exception' => $e->getMessage()];
            }
        }

        // ÜRETİM: AĞIR HAVUZ üzerinden FAILOVER (tryHeavy) — bir heavy instance SEGV/ölü ise (crash-loop
        // da dahil: 'Empty reply'/cURL 52 ERİŞİLEMEZ sayılır) sonrakine, son çare arka plan (PR) havuzuna
        // düşer. reviewmatch/analyzematch ile AYNI dayanıklılık; tek instance SEGV'i artık şansı (Luck V1)
        // DURDURAMAZ — SPOF kalktı. (Zaman aşımı failover sebebi DEĞİL: istek instance'ı hâlâ işliyor.)
        return $this->tryHeavy('/matchluck', ['mat' => $mat, 'selftest' => false], 180)
            ?? ['error' => 'heavy-unavailable'];
    }

    /**
     * Yüklenen .mat maçını gnubg ile TAM analiz eder (Mat Analiz sayfası).
     * Doner: ['ok'=>bool, 'matchLength'=>?int, 'names'=>[..], 'players'=>[p0,p1 özet],
     *        'stats'=>['sections'=>[..]], 'statistics_match'=>raw] veya hata.
     */
    public function analyzeMatch(string $mat, int $plies = 2): ?array
    {
        return $this->tryHeavy('/analyzematch', ['mat' => $mat, 'plies' => $plies], 240)
            ?? ['ok' => false, 'error' => 'heavy-unavailable'];
    }

    /**
     * Mat Analiz FAZ 2: yüklenen .mat maçını HAMLE-HAMLE analiz eder (görüntüleyici için).
     * Doner: ['ok'=>bool, 'matchLength'=>?int, 'names'=>[..], 'log'=>[LogEntry-uyumlu...]] veya hata.
     */
    public function reviewMatch(string $mat, int $plies = 2): ?array
    {
        return $this->tryHeavy('/reviewmatch', ['mat' => $mat, 'plies' => $plies], 600)
            ?? ['ok' => false, 'error' => 'heavy-unavailable'];
    }

    /**
     * AĞIR uçları (reviewmatch/analyzematch) heavyBases() sırasıyla dener: dedike heavy havuzu (shuffle)
     * -> son çare arka plan havuzu. İlk 2xx json'u döner; hepsi düşükse null. Bir heavy instance düşse
     * de eşzamanlı iki review gelse de Mat Analiz çalışır (shuffle farklı instance'a dağıtır; SPOF yok).
     * NOT: bir heavy instance MEŞGULse (mid-review, kilit tutuluyor) POST failover ETMEZ, kilitte bekler.
     * Shuffle'la yük dağılır ama 3. eşzamanlı review 2 instance'lı havuzda birine kuyruklanabilir (kabul
     * edilen tavan; havuzu büyüterek azaltılır). Failover yalnız DOWN/erişilemez instance içindir.
     */
    private function tryHeavy(string $path, array $payload, int $timeout): ?array
    {
        $bases = $this->heavyBases();
        $last = count($bases) - 1;
        foreach ($bases as $i => $base) {
            try {
                $resp = Http::timeout($timeout)
                    ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                    ->acceptJson()
                    ->post($base.$path, $payload);
                if ($resp->ok()) {
                    return $resp->json();
                }
                Log::warning('gnubg heavy non-ok', ['path' => $path, 'idx' => $i, 'base' => $base, 'status' => $resp->status()]);
            } catch (\Throwable $e) {
                // A-27: ZAMAN AŞIMI failover sebebi DEĞİL. gnubg bir hint'i iptal edemez -> instance hâlâ
                // bu isteği işliyor; aynı yükü sıradakine göndermek her instance'ı (canlı PR havuzu dahil)
                // N × timeout kilitliyordu (tek kullanıcıyla tüm ağır havuzu tıkama). Yalnız ERİŞİLEMEZ
                // (bağlantı reddi/DNS) instance'ta sonrakine geçilir.
                if (self::isTimeout($e)) {
                    Log::warning('gnubg heavy zaman asimi (failover yok)', ['path' => $path, 'base' => $base]);

                    return null;
                }
                Log::warning(
                    $i < $last ? 'gnubg heavy erisilemez, sonrakine geciliyor' : 'gnubg heavy erisilemez (tum instance dustu)',
                    ['path' => $path, 'base' => $base, 'msg' => $e->getMessage()],
                );
            }
        }

        return null;
    }

    /** cURL 28 / "timed out": istek instance'a ULAŞTI, yanıt süresi doldu. */
    public static function isTimeout(\Throwable $e): bool
    {
        $m = strtolower($e->getMessage());

        return str_contains($m, 'curl error 28') || str_contains($m, 'timed out') || str_contains($m, 'timeout was reached');
    }

    private function url(string $path): string
    {
        return rtrim((string) config('gnubg.url', 'http://127.0.0.1:8092'), '/').$path;
    }

    /**
     * AĞIR analiz uçları (reviewmatch/analyzematch/matchluck/selfplay/rollout) için URL. heavy_url
     * ayrı bir gnubg instance'ına (or. :8093) ayarlıysa CANLI botu (8092 /analyze) BLOKLAMAZ — uzun
     * analiz kilidi tutarken bot hamleleri kuyrukta beklemez. Ayarlı değilse url ile AYNI (tek instance).
     */
    private function heavyUrl(string $path): string
    {
        $base = (string) config('gnubg.heavy_url') ?: (string) config('gnubg.url', 'http://127.0.0.1:8092');

        return rtrim($base, '/').$path;
    }
}
