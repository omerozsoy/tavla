<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Referral;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Arkadaş davet (referral) uçları. Davet eden kullanıcı kendi linkini/kodunu görür ve
 * arkadaşının e-postasına davet maili gönderir (günde Referral::dailyLimit() ile sınırlı).
 */
class ReferralController extends Controller
{
    /** Kendi davet durumum: kod, link, ödül, başarılı davet sayısı, kalan günlük hak, gereken maç. */
    public function status(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'code' => Referral::codeFor($user),
            'link' => Referral::linkFor($user),
            'reward' => Referral::reward(),
            'count' => (int) ($user->referral_count ?? 0),
            'daily_limit' => Referral::dailyLimit(),
            'remaining_today' => max(0, Referral::dailyLimit() - $this->sentToday($user->id)),
        ]);
    }

    /** Arkadaşının e-postasına davet maili gönder. */
    public function invite(Request $request)
    {
        $user = $request->user();
        $data = $request->validate(['email' => ['required', 'email', 'max:120']]);
        $email = strtolower(trim($data['email']));

        if ($email === strtolower((string) $user->email)) {
            return response()->json(['message' => 'Kendini davet edemezsin.'], 422);
        }
        if (User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return response()->json(['message' => 'Bu e-posta zaten kayıtlı.'], 422);
        }

        $key = $this->dayKey($user->id);
        if ($this->sentToday($user->id) >= Referral::dailyLimit()) {
            return response()->json(['message' => 'Bugünkü davet hakkın doldu.'], 429);
        }

        try {
            Referral::sendInvite($user, $email);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Davet gönderilemedi, lütfen sonra tekrar dene.'], 502);
        }

        // Başarılı gönderimde sayacı artır (gün sonunda sıfırlanır).
        $count = Cache::increment($key);
        if ($count === 1) {
            Cache::put($key, 1, now()->endOfDay());
        }

        return response()->json([
            'ok' => true,
            'remaining_today' => max(0, Referral::dailyLimit() - (int) $count),
        ]);
    }

    private function dayKey(int $userId): string
    {
        return 'refinv:'.$userId.':'.now()->format('Ymd');
    }

    private function sentToday(int $userId): int
    {
        return (int) Cache::get($this->dayKey($userId), 0);
    }
}
