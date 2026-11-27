<?php

namespace App\Services\Recognition;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Fotograftan pozisyon tanima servisine (recognition/service.py) HTTP istemcisi. GnuBgClient
 * deseninin birebir esi: tanima'ya ozgu her sey serviste; burasi sadece HTTP.
 *
 * recognize() doner: ['ok'=>bool, 'position'=>{points[24],bar,turn,dice,cube}, 'debug'=>{...valid}].
 * debug.valid=false -> tanima guvenilmez (gnubg'ye gonderme, kullaniciya yeniden-cek de).
 */
class RecognitionClient
{
    public function health(): bool
    {
        try {
            return Http::timeout(5)->get($this->base().'/health')->ok();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Ham foto byte'larini tanima servisine gonderir. $flip=true -> tahta 180 cevrilmis okunur
     * (yonelim belirsizligi icin toggle). Basarili yanitta tam JSON, aksi halde null.
     */
    public function recognize(string $imageBytes, bool $flip = false): ?array
    {
        try {
            $resp = Http::timeout((int) config('recognition.timeout', 30))
                ->withHeaders(['x-recog-secret' => (string) config('recognition.secret')])
                ->withBody($imageBytes, 'application/octet-stream')
                ->acceptJson()
                ->post($this->base().'/recognize'.($flip ? '?flip=1' : ''));
            if ($resp->ok()) {
                return $resp->json();
            }
            Log::warning('recognition non-ok', ['status' => $resp->status()]);
        } catch (\Throwable $e) {
            Log::warning('recognition erisilemez', ['msg' => $e->getMessage()]);
        }

        return null;
    }

    private function base(): string
    {
        return rtrim((string) config('recognition.url', 'http://127.0.0.1:8095'), '/');
    }
}
