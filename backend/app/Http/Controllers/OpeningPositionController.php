<?php

namespace App\Http\Controllers;

use App\Models\OpeningPosition;
use Illuminate\Http\Request;

/**
 * Açılış pratiği havuzu — HALKA AÇIK, sayfalı. ~84k motor-doğrulanmış açılış pozisyonu
 * bundle'a gömülü DEĞİL; frontend band'e göre lazy çeker (Dersler ve Eğitim > Açılış Pratiği).
 *   - counts : band => pozisyon sayısı (frontend ders stub'larını buradan kurar)
 *   - index  : ?band=zor&page=1&per=10 -> o band'in sayfası (stabil id sırası)
 */
class OpeningPositionController extends Controller
{
    private const BANDS = ['cok_kolay', 'kolay', 'orta', 'zor', 'cok_zor'];

    public function counts()
    {
        $counts = OpeningPosition::selectRaw('band, COUNT(*) as n')->groupBy('band')->pluck('n', 'band');

        return response()->json((object) $counts);
    }

    public function index(Request $r)
    {
        $band = (string) $r->query('band', '');
        if (! in_array($band, self::BANDS, true)) {
            return response()->json(['error' => 'bad_band'], 422);
        }
        $page = max(1, (int) $r->query('page', 1));
        $per = min(50, max(1, (int) $r->query('per', 10)));

        $items = OpeningPosition::where('band', $band)
            ->orderBy('id')
            ->forPage($page, $per)
            ->get(['xgid', 'answer', 'dice']);

        return response()->json(['items' => $items]);
    }
}
