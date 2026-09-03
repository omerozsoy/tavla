<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Fotograftan pozisyon (CV) — Python board-cv microservice'ine GUVENLI proxy.
 * Auth + throttle route'ta; burada upload guvenligi + servise yonlendirme.
 * Servis ic agda (BOARD_CV_URL, or. http://127.0.0.1:8091); internete acilmaz.
 */
class PhotoDetectController extends Controller
{
    public function detect(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'max:12288'], // <= 12MB
            'corners' => ['required', 'string'], // JSON: {topLeft,topRight,bottomRight,bottomLeft}
        ]);

        $base = config('services.board_cv.url');
        if (! $base) {
            return response()->json(['message' => 'CV servisi yapilandirilmadi (BOARD_CV_URL yok).'], 503);
        }

        // Kose JSON'u dogrula (bicimsel)
        $corners = json_decode($request->input('corners'), true);
        $keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
        foreach ($keys as $k) {
            if (! isset($corners[$k]['x'], $corners[$k]['y'])) {
                return response()->json(['message' => 'Gecersiz kose verisi.'], 422);
            }
        }

        $file = $request->file('image');
        try {
            $resp = Http::timeout((int) config('services.board_cv.timeout', 30))
                ->attach('image', file_get_contents($file->getRealPath()), 'board.jpg')
                ->post(rtrim($base, '/').'/detect-position', [
                    'corners' => $request->input('corners'),
                ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'CV servisine ulasilamadi.'], 502);
        }

        if (! $resp->ok()) {
            return response()->json([
                'message' => 'Pozisyon okunamadi.',
                'detail' => $resp->json('detail'),
            ], $resp->status() === 422 ? 422 : 502);
        }

        return response()->json($resp->json());
    }
}
