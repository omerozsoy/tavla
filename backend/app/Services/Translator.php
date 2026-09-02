<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Hafif metin cevirisi (anahtarsiz MyMemory API'si). Menu adlari gibi DUSUK HACIMLI,
 * nadir islemler icindir — kaydederken cagrilir, kullanici-yolunda degil. Basarisiz
 * olursa null doner; cagiran taraf kaynak metne duser (asla patlamaz).
 *
 * Not: Google'in anahtarsiz translate_a ucu sunucu IP'lerinde 429 veriyor; MyMemory
 * (gunluk ~1000 kelime, e-posta ile ~50k) menu adlari icin fazlasiyla yeterli.
 */
class Translator
{
    public static function translate(string $text, string $to, string $from = 'tr'): ?string
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        if ($to === $from) {
            return $text;
        }

        try {
            $res = Http::timeout(8)->get('https://api.mymemory.translated.net/get', [
                'q' => $text,
                'langpair' => $from.'|'.$to,
                'de' => config('mail.from.address', 'info@tavlai.com'), // kota artirir
            ]);
            if (! $res->ok()) {
                return null;
            }
            $out = trim((string) $res->json('responseData.translatedText'));
            // Hata/uyari metinleri cevrilmis gibi gelebilir — ele.
            if ($out === '' || str_contains(strtoupper($out), 'MYMEMORY WARNING')
                || str_contains(strtoupper($out), 'INVALID') || str_contains($out, 'QUERY LENGTH LIMIT')) {
                return null;
            }

            return $out;
        } catch (\Throwable $e) {
            Log::warning('Translator failed: '.$e->getMessage());

            return null;
        }
    }
}
