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
     * Yapisal konumu analiz et. Doner: ['gnubgid'=>..., 'result'=>gnubg.hint()] veya null.
     * gnubg.hint().hint[] = adaylar: {move, equity(cubeful/EMG), eqdiff(kayip), details.probs}.
     */
    public function analyze(array $position): ?array
    {
        try {
            $resp = Http::timeout((int) config('gnubg.timeout', 20))
                ->withHeaders(['x-gnubg-secret' => (string) config('gnubg.secret')])
                ->acceptJson()
                ->post($this->url('/analyze'), $position);
            if (! $resp->ok()) {
                Log::warning('gnubg analyze non-ok', ['status' => $resp->status(), 'body' => $resp->body()]);

                return null;
            }

            return $resp->json();
        } catch (\Throwable $e) {
            Log::warning('gnubg analyze exception', ['msg' => $e->getMessage()]);

            return null;
        }
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
                ->post($this->url('/selfplay'), $params);
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
                ->post($this->url('/cubetest'), $position);

            return $resp->ok() ? $resp->json() : ['http_status' => $resp->status(), 'body' => $resp->body()];
        } catch (\Throwable $e) {
            return ['exception' => $e->getMessage()];
        }
    }

    private function url(string $path): string
    {
        return rtrim((string) config('gnubg.url', 'http://127.0.0.1:8092'), '/').$path;
    }
}
