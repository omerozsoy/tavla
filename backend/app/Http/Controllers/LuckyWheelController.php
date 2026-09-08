<?php

namespace App\Http\Controllers;

use App\Services\LuckyWheel\LuckyWheelService;
use Illuminate\Http\Request;

/**
 * Şans Çarkı kullanıcı ucu. Kazananı DAİMA backend belirler (LuckyWheelService::spin);
 * bu controller yalnız durumu döndürür ve hataları mesaja çevirir.
 */
class LuckyWheelController extends Controller
{
    public function __construct(private LuckyWheelService $wheel)
    {
    }

    // GET /lucky-wheel — çark durumu (ödüller, kalan hak, ayarlar).
    public function show(Request $request)
    {
        return response()->json($this->wheel->stateFor($request->user()));
    }

    // POST /lucky-wheel/spin — güvenli çevirme. Sonuç sunucuda seçilir.
    public function spin(Request $request)
    {
        $result = $this->wheel->spin($request->user());

        if (isset($result['error'])) {
            return $this->mapError($result);
        }

        return response()->json([
            'success' => true,
            'reward' => $result['reward'],
            'winningRewardId' => $result['winningRewardId'],
            'remainingSpins' => $result['remainingSpins'],
            'bonusSpins' => $result['bonusSpins'],
            'nextFreeSpinAt' => $result['nextFreeSpinAt'],
            'coins' => $result['coins'],
            'spinCost' => $result['spinCost'] ?? 0,
            'nextSpinPaid' => $result['nextSpinPaid'] ?? false,
            'paid' => $result['paid'] ?? false,
            'user' => $result['user'],
        ]);
    }

    private function mapError(array $r)
    {
        return match ($r['error']) {
            'disabled' => $this->fail('Şans Çarkı şu an kapalı.', 422),
            'not_ready' => $this->fail('Şans Çarkı henüz hazır değil.', 422),
            'no_reward' => $this->fail('Şu an kazanılabilir ödül kalmadı, sonra tekrar dene.', 422),
            'no_spins' => $this->fail('Çevirme hakkın kalmadı.', 422, [
                'nextFreeSpinAt' => $r['nextFreeSpinAt'] ?? null,
            ]),
            'need_coins' => $this->fail('Bu çevirme '.($r['cost'] ?? 0).' coin. Yeterli coin\'in yok.', 422, [
                'cost' => $r['cost'] ?? 0,
                'nextFreeSpinAt' => $r['nextFreeSpinAt'] ?? null,
            ]),
            'cooldown' => $this->fail('Biraz bekle, tekrar çevirebilirsin.', 429, [
                'seconds' => $r['seconds'] ?? 0,
            ]),
            default => $this->fail('Çevirme başarısız.', 422),
        };
    }
}
