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
     * /analyze FAILOVER tabanları (birincil + yedek[ler]), sırayla. url_backup virgülle ayrılmış olabilir.
     * Boşları eler, sondaki '/'i kırpar. Tek eleman -> eski tek-instance davranışı (geriye dönük uyum).
     * PUBLIC: admin "Servis Durumu" paneli + services:watch her instance'ı ayrı gösterir/izler.
     */
    public function analyzeBases(): array
    {
        $primary = rtrim((string) config('gnubg.url', 'http://127.0.0.1:8092'), '/');
        $backups = array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) config('gnubg.url_backup', '')),
        );

        return array_values(array_filter(array_merge([$primary], $backups), fn ($u) => $u !== ''));
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
        // FAILOVER: tabanları SIRAYLA dener, ilk 2xx yanıtı döndürür. Birincil (canlı bot :8092)
        // down/yavaş/restart ise yedek instance (:8093 vb.) devreye girer -> PR "—" kalmaz + canlı bot
        // da hamle üretmeye devam eder (ikisi de analyze() kullanır). HEPSİ düşükse null -> AnalyzeMatchPrJob
        // fırlatır (retry) + heal cron gnubg dönünce yeniden dener. Tek instance -> eski davranış.
        $bases = $this->analyzeBases();
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
                    $i < $last ? 'gnubg analyze erisilemez, yedege geciliyor' : 'gnubg analyze erisilemez (tum instance dustu)',
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
        try {
            $resp = Http::timeout(180) // import + analyse match
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/matchluck'), ['mat' => $mat, 'selftest' => $selftest]);

            return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['exception' => $e->getMessage()];
        }
    }

    /**
     * Yüklenen .mat maçını gnubg ile TAM analiz eder (Mat Analiz sayfası).
     * Doner: ['ok'=>bool, 'matchLength'=>?int, 'names'=>[..], 'players'=>[p0,p1 özet],
     *        'stats'=>['sections'=>[..]], 'statistics_match'=>raw] veya hata.
     */
    public function analyzeMatch(string $mat, int $plies = 2): ?array
    {
        try {
            $resp = Http::timeout(240) // import + analyse match (uzun sürebilir)
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/analyzematch'), ['mat' => $mat, 'plies' => $plies]);

            return $resp->ok() ? $resp->json() : ['ok' => false, 'http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['ok' => false, 'exception' => $e->getMessage()];
        }
    }

    /**
     * Mat Analiz FAZ 2: yüklenen .mat maçını HAMLE-HAMLE analiz eder (görüntüleyici için).
     * Doner: ['ok'=>bool, 'matchLength'=>?int, 'names'=>[..], 'log'=>[LogEntry-uyumlu...]] veya hata.
     */
    public function reviewMatch(string $mat, int $plies = 2): ?array
    {
        try {
            $resp = Http::timeout(600) // hamle-hamle hint çok uzun sürebilir (maç boyu × oyuncu)
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->heavyUrl('/reviewmatch'), ['mat' => $mat, 'plies' => $plies]);

            return $resp->ok() ? $resp->json() : ['ok' => false, 'http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['ok' => false, 'exception' => $e->getMessage()];
        }
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
