<?php

namespace App\Http\Controllers;

use App\Services\DiceSlot\DiceSlotService;
use Illuminate\Http\Request;

/**
 * Zar Slotu kullanıcı ucu. Makara sonuçlarını DAİMA backend belirler (DiceSlotService::spin);
 * bu controller yalnız durumu döndürür ve hataları mesaja çevirir. (LuckyWheelController kardeşi.)
 */
class DiceSlotController extends Controller
{
    public function __construct(private DiceSlotService $slot)
    {
    }

    // GET /dice-slot — slot durumu (ödül tablosu, jackpot, kalan hak, ayarlar).
    // ROTA HERKESE AÇIK (misafir de görebilir) -> token varsa Sanctum guard'ıyla çöz.
    public function show(Request $request)
    {
        $user = $request->user('sanctum') ?: $request->user();

        return response()->json($this->slot->stateFor($user));
    }

    // POST /dice-slot/spin — güvenli çevirme. Sonuç sunucuda seçilir.
    public function spin(Request $request)
    {
        $result = $this->slot->spin($request->user());

        if (isset($result['error'])) {
            return $this->mapError($result);
        }

        return response()->json([
            'success' => true,
            'reels' => $result['reels'],
            'winType' => $result['winType'],
            'payout' => $result['payout'],
            'matchedValue' => $result['matchedValue'],
            'jackpot' => $result['jackpot'],
            'jackpotWon' => $result['jackpotWon'],
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
            'disabled' => $this->fail('Zar Slotu şu an kapalı.', 422),
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
