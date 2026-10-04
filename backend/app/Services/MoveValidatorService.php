<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sunucu-otoriter hamle doğrulama köprüsü (para maçı güvenliği Faz 2b).
 *
 * Node validator servisine (bkz validator/) HTTP ile sorar. Motor TS'te tek gerçek kaynak;
 * PHP burada yalnız aracıdır. Validator erişilemezse: FAIL-CLOSED — çağıran hamleyi REDDEDER.
 */
class MoveValidatorService
{
    /** Sıralı validator tabanları: [birincil, yedek...]. Birincil düşükse SIRAYLA denenir (failover). */
    private array $urls;

    /** AĞIR analiz (/analyze-pr) tabanları — /validate'ten AYRI. Boşsa $urls'e düşer. */
    private array $heavyUrls;

    private string $secret;

    private float $timeout;

    private bool $verifyTls;

    public function __construct()
    {
        $cfg = config('validator');
        // Birincil + yedek(ler). Yedek virgülle ayrılmış olabilir. Boşları ele, sondaki '/'i kırp.
        $primary = rtrim((string) ($cfg['url'] ?? ''), '/');
        $backups = array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) ($cfg['url_backup'] ?? '')),
        );
        $this->urls = array_values(array_filter(array_merge([$primary], $backups), fn ($u) => $u !== ''));
        // AĞIR analiz tabanları (adanmış). Boşsa normal $urls kullanılır -> davranış değişmez.
        $heavyPrimary = rtrim((string) ($cfg['heavy_url'] ?? ''), '/');
        $heavyBackups = array_map(
            fn ($u) => rtrim(trim((string) $u), '/'),
            explode(',', (string) ($cfg['heavy_url_backup'] ?? '')),
        );
        $heavy = array_values(array_filter(array_merge([$heavyPrimary], $heavyBackups), fn ($u) => $u !== ''));
        $this->heavyUrls = $heavy !== [] ? $heavy : $this->urls;
        $this->secret = (string) ($cfg['secret'] ?? '');
        $this->timeout = (float) ($cfg['timeout'] ?? 3);
        $this->verifyTls = (bool) ($cfg['verify_tls'] ?? false);
    }

    public function isConfigured(): bool
    {
        return count($this->urls) > 0;
    }

    /** Yapılandırılmış validator tabanları (birincil + yedekler), sırayla. Panelde ayrı gösterim için. */
    public function bases(): array
    {
        return $this->urls;
    }

    /** Bir tabanın /health'ini oku (ör. worker sayısı). Erişilemezse null. Panel gösterimi için. */
    public function healthAt(string $base): ?array
    {
        try {
            $res = $this->client()->timeout(2)->get(rtrim($base, '/').'/health');

            return $res->successful() ? (array) $res->json() : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** TEK bir tabanı DOĞRUDAN yokla (failover'sız): admin panelinde her örneğin ayrı lambası için. */
    public function probeBase(string $base, array $state, array $steps): bool
    {
        try {
            $res = $this->client()->post(rtrim($base, '/').'/validate', ['state' => $state, 'steps' => $steps]);

            return $res->successful() && (bool) ($res->json('valid') ?? false);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * YEDEKLİ (failover) POST: tabanları SIRAYLA (birincil->yedekler) dener, ilk 2xx yanıtı döndürür.
     * Birincil erişilemez / 5xx ise yedek devreye girer -> tek validator düşse de maç akışı DURMAZ.
     * HEPSİ düşükse null (çağıran fail-closed davranır). $timeout verilirse o istekte varsayılanı ezer.
     *
     * DAİMA-BİRİNCİL-ÖNCE (rastgele başlangıç KALDIRILDI): eskiden yük dağıtımı için rastgele bir
     * tabandan başlanıyordu. Ama birincil artık ÇOK-WORKER cluster (OS zaten worker'lara dağıtır),
     * yani istemci-tarafı yayılıma gerek yok. Dahası tabanlar EŞİT DEĞİLSE (hızlı yerel vs YAVAŞ
     * uzak/Passenger yedek) rastgele başlangıç isteklerin ~1/n'ini yavaş yedeğe sokup turnuvada
     * "Onayla -> Gönderiliyor… 4-5sn takılıyor" yaratıyordu [[turnuva-akicilik-validator-darbogazi]].
     * Artık yedekler SAF STANDBY: yalnız birincil GERÇEKTEN başarısız olunca vurulur -> ileride yavaş
     * bir yedek eklense bile sağlıklı istek asla oraya gitmez (sorun bir daha olmaz).
     */
    private function postFailover(string $path, array $payload, ?float $timeout = null, ?array $bases = null): ?\Illuminate\Http\Client\Response
    {
        $urls = $bases ?? $this->urls;
        $n = count($urls);
        if ($n === 0) {
            return null;
        }
        for ($i = 0; $i < $n; $i++) {
            $base = $urls[$i];
            try {
                $req = $this->client();
                if ($timeout !== null) {
                    $req = $req->timeout($timeout);
                }
                $res = $req->post($base.$path, $payload);
                if ($res->successful()) {
                    return $res;
                }
                Log::warning('validator non-2xx', ['idx' => $i, 'path' => $path, 'status' => $res->status()]);
                // A-31: istek HATALI (400/413/422…) -> her yedekte aynı sonuç; yükü çoğaltma ve
                // sahte "validator erişilemez" alarmı üretme. (401/408/429 örneğe özgü olabilir -> dene.)
                $st = $res->status();
                if ($st >= 400 && $st < 500 && ! in_array($st, [401, 408, 429], true)) {
                    return null;
                }
            } catch (\Throwable $e) {
                // Bu taban erişilemez -> sıradaki yedeği dene; hepsi tükenirse null.
                Log::warning(
                    $i < $n - 1 ? 'validator unreachable, yedeğe geçiliyor' : 'validator unreachable (tüm tabanlar düştü)',
                    ['idx' => $i, 'path' => $path, 'err' => $e->getMessage()],
                );
            }
        }

        return null;
    }

    private function headers(): array
    {
        return $this->secret !== '' ? ['x-validator-secret' => $this->secret] : [];
    }

    // Iç servis (aynı sunucu, secret korumalı). SSL kurulu değilse doğrulamayı atla.
    private function client()
    {
        return Http::withHeaders($this->headers())
            ->withOptions(['verify' => $this->verifyTls])
            ->timeout($this->timeout)
            ->acceptJson();
    }

    /**
     * Otoriter $state (zar dolu) için istemcinin önerdiği $steps yasal bir tam-tur mu?
     * Dönüş: ['valid'=>bool, 'state'=>?array, 'reason'=>?string, 'unreachable'=>?bool].
     * Yasalsa 'state' uygulanmış + sıra devredilmiş yeni durumdur.
     */
    public function validate(array $state, array $steps): array
    {
        if (! $this->isConfigured()) {
            return ['valid' => false, 'reason' => 'validator-not-configured', 'unreachable' => true];
        }
        $res = $this->postFailover('/validate', ['state' => $state, 'steps' => $steps]);
        if ($res === null) {
            return ['valid' => false, 'reason' => 'validator-unreachable', 'unreachable' => true];
        }
        $data = $res->json();

        return [
            'valid' => (bool) ($data['valid'] ?? false),
            'state' => $data['state'] ?? null,
            'reason' => $data['reason'] ?? null,
        ];
    }

    /**
     * Otoriter $state için tüm yasal tam-tur hamleleri (sunucunun "hamle var mı / dance mı /
     * oyun bitti mi" bilmesi için). Erişilemezse null.
     */
    public function legalMoves(array $state): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }
        $res = $this->postFailover('/legal-moves', ['state' => $state]);

        return $res !== null ? ($res->json('moves') ?? []) : null;
    }

    /**
     * Validator'ı yeniden başlat (admin panel butonu). Süreç kendini kapatır; Plesk/Passenger
     * (veya pm2/systemd) bir sonraki istekte canlandirir. Dönüş: ['ok'=>bool, 'error'=>?string].
     * NOT: süreç yöneticisi YOKSA (bare `node`) geri gelmez — bu Plesk kurulumunda geçerli değil.
     */
    public function restartValidator(): array
    {
        $did = false;
        $errors = [];

        // 1) Passenger restart dosyasına DOKUN — süreç ÇÖKMÜŞken bile çalışır (Node koduna bağlı
        //    değil; Passenger dosyayı görüp app'i yeniden başlatır). Otomatik kurtarmanın ası budur.
        $file = (string) config('validator.restart_file', '');
        if ($file !== '') {
            try {
                $dir = dirname($file);
                if (! is_dir($dir)) {
                    @mkdir($dir, 0775, true);
                }
                if (@touch($file)) {
                    $did = true;
                } else {
                    $errors[] = 'touch-failed';
                }
            } catch (\Throwable $e) {
                $errors[] = 'touch-exc';
                Log::warning('validator.restart touch failed', ['file' => $file, 'err' => $e->getMessage()]);
            }
        }

        // 2) /restart ucu — servis AYAKTAYKEN graceful (yeni sürümde var). Down iken bağlantı düşer.
        //    HER tabana (birincil + yedekler) gönder -> tüm örnekler tazelenir.
        foreach ($this->urls as $base) {
            try {
                $res = $this->client()->timeout(5)->post($base.'/restart');
                if ($res->successful()) {
                    $did = true;
                } else {
                    $errors[] = 'status-'.$res->status();
                }
            } catch (\Throwable $e) {
                // Süreç yanıtı gönderip hemen kapandıysa (yeni sürüm) bağlantı düşebilir -> tetiklendi.
                $did = true;
            }
        }

        return $did
            ? ['ok' => true, 'error' => null]
            : ['ok' => false, 'error' => $errors ? implode(',', $errors) : 'no-mechanism'];
    }

    /**
     * SUNUCU-OTORİTER PR: verilen oyuncunun ($hc) kararlarını Node validator'da sinir agiyla
     * YENİDEN değerlendirip PR döndürür (istemcinin gönderdiği loss'a güvenmez). $log =
     * MoveLogEntry dizisi (pos/dice/playedSteps/player alanları). Erişilemez/eksikse null.
     * Dönüş: ['pr'=>?float, 'decisions'=>int] veya null (validator yok/hatalı).
     */
    public function analyzePr(string $hc, array $log, int $matchLength = 1, bool $isMoney = false): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }
        // PR analizi motor çalıştırır (yavaş olabilir) -> daha uzun timeout; yedekli. AĞIR işi
        // ADANMIŞ instance'a yolla ($heavyUrls; VALIDATOR_HEAVY_URL boşsa normal url'e düşer) ->
        // sinir ağı analizi canlı /validate instance'ının event-loop'unu bloklamaz (anlık yavaşlık fix).
        $res = $this->postFailover('/analyze-pr', [
            'hc' => $hc, 'log' => $log, 'matchLength' => $matchLength, 'isMoney' => $isMoney,
        ], max($this->timeout, 20), $this->heavyUrls);
        if ($res === null) {
            return null;
        }

        // XG-style: overall.pr + kirilim (checker/cube) + havuzlama icin totaller.
        return [
            'pr' => $res->json('pr'),                          // overall.pr
            'decisions' => (int) $res->json('decisions', 0),   // overall.decisions
            'equity_lost' => (float) $res->json('overall.equityLost', 0),
            'checker' => $res->json('checker'),
            'cube' => $res->json('cube'),
            'overall' => $res->json('overall'),
        ];
    }
}
