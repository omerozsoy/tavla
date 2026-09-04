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
    private string $url;

    private string $secret;

    private float $timeout;

    private bool $verifyTls;

    public function __construct()
    {
        $cfg = config('validator');
        $this->url = rtrim((string) ($cfg['url'] ?? ''), '/');
        $this->secret = (string) ($cfg['secret'] ?? '');
        $this->timeout = (float) ($cfg['timeout'] ?? 3);
        $this->verifyTls = (bool) ($cfg['verify_tls'] ?? false);
    }

    public function isConfigured(): bool
    {
        return $this->url !== '';
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
        try {
            $res = $this->client()->post($this->url.'/validate', ['state' => $state, 'steps' => $steps]);

            if (! $res->successful()) {
                Log::warning('validator.validate non-2xx', ['status' => $res->status()]);

                return ['valid' => false, 'reason' => 'validator-error', 'unreachable' => true];
            }
            $data = $res->json();

            return [
                'valid' => (bool) ($data['valid'] ?? false),
                'state' => $data['state'] ?? null,
                'reason' => $data['reason'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('validator.validate unreachable', ['err' => $e->getMessage()]);

            return ['valid' => false, 'reason' => 'validator-unreachable', 'unreachable' => true];
        }
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
        try {
            $res = $this->client()->post($this->url.'/legal-moves', ['state' => $state]);

            return $res->successful() ? ($res->json('moves') ?? []) : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Validator'ı yeniden başlat (admin panel butonu). Süreç kendini kapatır; Plesk/Passenger
     * (veya pm2/systemd) bir sonraki istekte canlandirir. Dönüş: ['ok'=>bool, 'error'=>?string].
     * NOT: süreç yöneticisi YOKSA (bare `node`) geri gelmez — bu Plesk kurulumunda geçerli değil.
     */
    public function restartValidator(): array
    {
        if (! $this->isConfigured()) {
            return ['ok' => false, 'error' => 'validator-not-configured'];
        }
        try {
            $res = $this->client()->timeout(5)->post($this->url.'/restart');

            // 200 döndüyse kapanma tetiklendi (süreç yanıttan hemen sonra exit eder).
            return $res->successful()
                ? ['ok' => true, 'error' => null]
                : ['ok' => false, 'error' => 'status-'.$res->status()];
        } catch (\Throwable $e) {
            // Süreç yanıtı gönderip HEMEN kapandıysa bağlantı düşebilir -> yine de restart tetiklendi.
            Log::info('validator.restart connection closed (muhtemelen restart tetiklendi)', ['err' => $e->getMessage()]);

            return ['ok' => true, 'error' => null];
        }
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
        try {
            // PR analizi motor calistirir (yavas olabilir) -> daha uzun timeout.
            $res = $this->client()
                ->timeout(max($this->timeout, 20))
                ->post($this->url.'/analyze-pr', [
                    'hc' => $hc, 'log' => $log, 'matchLength' => $matchLength, 'isMoney' => $isMoney,
                ]);
            if (! $res->successful()) {
                Log::warning('validator.analyzePr non-2xx', ['status' => $res->status()]);

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
        } catch (\Throwable $e) {
            Log::warning('validator.analyzePr unreachable', ['err' => $e->getMessage()]);

            return null;
        }
    }
}
