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
     * YEDEKLİ (failover) POST: tabanları SIRAYLA dener, ilk 2xx yanıtı döndürür. Birincil
     * erişilemez / 5xx ise yedek devreye girer -> tek validator düşse de maç akışı DURMAZ. HEPSİ
     * düşükse null (çağıran fail-closed davranır). $timeout verilirse o istekte varsayılanı ezer.
     */
    private function postFailover(string $path, array $payload, ?float $timeout = null): ?\Illuminate\Http\Client\Response
    {
        $last = count($this->urls) - 1;
        foreach ($this->urls as $i => $base) {
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
            } catch (\Throwable $e) {
                // Bu taban erişilemez -> sıradaki yedeği dene; sonuncuda da olmazsa null.
                Log::warning(
                    $i < $last ? 'validator unreachable, yedeğe geçiliyor' : 'validator unreachable (tüm tabanlar düştü)',
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
        // PR analizi motor çalıştırır (yavaş olabilir) -> daha uzun timeout; yedekli.
        $res = $this->postFailover('/analyze-pr', [
            'hc' => $hc, 'log' => $log, 'matchLength' => $matchLength, 'isMoney' => $isMoney,
        ], max($this->timeout, 20));
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
