<?php

namespace App\Http\Controllers;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pozisyon Analizi ekranı (frontend PositionAnalyzer) için GNU Backgammon motoru.
 *
 * Tarayıcıdaki wildbg sinir ağına EK olarak, kullanıcı "GNU" motorunu seçince bu uç çağrılır:
 * yapısal konumu gnubg servisine gönderir, gnubg'nin hint/evaluate sonucunu frontend'in beklediği
 * ORTAK biçime çevirir (probs = 6'lı DIŞLAYAN [wn,wg,wb,ln,lg,lb]; wildbg ile birebir aynı ki
 * mevcut kazanma%/gammon/bg + küp gösterimi ikisinde de aynı çalışsın).
 *
 * gnubg 5'li KÜMÜLATIF (win, winGammon, winBackgammon, loseGammon, loseBackgammon) verir;
 * probs6() bunu dışlayan 6'lıya çevirir (loseAny = 1 - win).
 */
class AnalysisController extends Controller
{
    public function __construct(private GnuBgClient $gnubg) {}

    public function position(Request $request): JsonResponse
    {
        $data = $request->validate([
            'points' => 'required|array|size:24',
            'points.*' => 'required|integer|min:-15|max:15',
            'bar' => 'array',
            'bar.white' => 'integer|min:0|max:15',
            'bar.black' => 'integer|min:0|max:15',
            'turn' => 'required|in:white,black',
            'dice' => 'array',
            'dice.*' => 'integer|min:1|max:6',
            'cube' => 'array',
            'cube.value' => 'integer',
            'cube.owner' => 'nullable|in:white,black',
            'score' => 'array',
            'score.white' => 'integer|min:0',
            'score.black' => 'integer|min:0',
            'matchLength' => 'integer|min:0|max:99',
            'plies' => 'integer|min:0|max:3',
        ]);

        // Yalnız geçerli zarlar (1-6). İki zar -> hamle analizi; aksi -> pozisyon/küp analizi.
        $dice = array_values(array_filter(
            array_map('intval', $data['dice'] ?? []),
            fn ($d) => $d >= 1 && $d <= 6,
        ));

        $structured = [
            'points' => array_map('intval', $data['points']),
            'bar' => $data['bar'] ?? ['white' => 0, 'black' => 0],
            'turn' => $data['turn'],
            'dice' => $dice,
            'matchLength' => (int) ($data['matchLength'] ?? 0),
            'plies' => (int) ($data['plies'] ?? 2),
        ];
        if (! empty($data['cube'])) {
            $structured['cube'] = $data['cube'];
        }
        if (! empty($data['score'])) {
            $structured['score'] = $data['score'];
        }

        $res = $this->gnubg->analyze($structured);
        if ($res === null) {
            return $this->fail('gnubg-unavailable', 503);
        }

        // ZARLI -> aday hamleler (equity'ye göre sıralı; gnubg cubeful/EMG equity).
        if (count($dice) >= 2 && isset($res['result']['hint']) && is_array($res['result']['hint'])) {
            $moves = [];
            foreach ($res['result']['hint'] as $c) {
                if (! is_array($c)) {
                    continue;
                }
                $moves[] = [
                    'notation' => (string) ($c['move'] ?? ''),
                    'equity' => (float) ($c['equity'] ?? 0),
                    'probs' => $this->probs6($c['details']['probs'] ?? null),
                ];
            }

            return response()->json([
                'engine' => 'gnubg',
                'gnubgid' => $res['gnubgid'] ?? null,
                'moves' => $moves,
            ]);
        }

        // ZARSIZ -> pozisyon değerlendirmesi (kazanma%/gammon/bg) + gnubg küp analizi (ham).
        return response()->json([
            'engine' => 'gnubg',
            'gnubgid' => $res['gnubgid'] ?? null,
            'probs' => $this->probs6($res['evaluate'] ?? null),
            'cube' => $res['cube'] ?? null,
        ]);
    }

    /**
     * gnubg 5'li KÜMÜLATIF (W, WG, WB, LG, LB) -> frontend 6'lı DIŞLAYAN [wn, wg, wb, ln, lg, lb].
     * equityFrom() (src/engine/encoding.ts) ve gösterim bu dışlayan biçimi bekler.
     */
    private function probs6(mixed $p): ?array
    {
        if (! is_array($p) || count($p) < 5) {
            return null;
        }
        $w = (float) $p[0];   // P(kazan, herhangi)
        $wg = (float) $p[1];  // P(kazan >= gammon)
        $wb = (float) $p[2];  // P(kazan backgammon)
        $lg = (float) $p[3];  // P(kaybet >= gammon)
        $lb = (float) $p[4];  // P(kaybet backgammon)
        $loseAny = max(0.0, 1.0 - $w);

        return [
            max(0.0, $w - $wg),        // kazan tekli
            max(0.0, $wg - $wb),       // kazan gammon (tam)
            max(0.0, $wb),             // kazan backgammon
            max(0.0, $loseAny - $lg),  // kaybet tekli
            max(0.0, $lg - $lb),       // kaybet gammon (tam)
            max(0.0, $lb),             // kaybet backgammon
        ];
    }
}
