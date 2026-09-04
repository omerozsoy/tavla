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
     * SUNUCU-OTORİTER PR: verilen oyuncunun ($hc) kararlarını Node validator'da sinir agiyla
     * YENİDEN değerlendirip PR döndürür (istemcinin gönderdiği loss'a güvenmez). $log =
     * MoveLogEntry dizisi (pos/dice/playedSteps/player alanları). Erişilemez/eksikse null.
     * Dönüş: ['pr'=>?float, 'decisions'=>int] veya null (validator yok/hatalı).
     */
    public function analyzePr(string $hc, array $log): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }
        try {
            // PR analizi motor calistirir (yavas olabilir) -> daha uzun timeout.
            $res = $this->client()
                ->timeout(max($this->timeout, 20))
                ->post($this->url.'/analyze-pr', ['hc' => $hc, 'log' => $log]);
            if (! $res->successful()) {
                Log::warning('validator.analyzePr non-2xx', ['status' => $res->status()]);

                return null;
            }

            return ['pr' => $res->json('pr'), 'decisions' => (int) $res->json('decisions', 0)];
        } catch (\Throwable $e) {
            Log::warning('validator.analyzePr unreachable', ['err' => $e->getMessage()]);

            return null;
        }
    }
}
