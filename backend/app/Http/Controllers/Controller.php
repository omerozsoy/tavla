<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * API cevap konvansiyonu (iki katman) — frontend (src/api.ts) buna dayanir:
 *
 *  1) SERT HATA (kimlik/yetki/dogrulama/bulunamadi): HTTP 4xx/5xx + {message, errors?}.
 *     Frontend req() bunu !res.ok'ta ApiError(status, message, errors) olarak firlatir.
 *     -> Her zaman $this->fail(mesaj, durum, ekstra?) kullan.
 *
 *  2) YUMUSAK SONUC (is akisi sinyali: yetersiz coin, settle pending, sahip vb.):
 *     HTTP 200 + acik bayrak alanlari ({ok, pending, owned, coins ...}). Bunlar
 *     istisna DEGIL; cagiran taraf alanlari okur. Basit onay icin $this->ok().
 *     Nuansli payload'lar (settle/shop) acik response()->json(...) ile kalir.
 */
abstract class Controller
{
    // Sert hata: 4xx/5xx + {message} (+ istege bagli errors/ekstra veri).
    protected function fail(string $message, int $status = 422, array $extra = []): JsonResponse
    {
        return response()->json(['message' => $message] + $extra, $status);
    }

    // Basit basari onayi: {ok:true} (+ istege bagli ek alanlar).
    protected function ok(array $data = []): JsonResponse
    {
        return response()->json(['ok' => true] + $data);
    }
}
