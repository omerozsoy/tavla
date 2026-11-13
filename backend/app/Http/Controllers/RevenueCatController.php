<?php

namespace App\Http\Controllers;

use App\Support\RevenueCat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * RevenueCat (Android Play Billing) Premium senkron uçları. Gerçek premium verme/alma RevenueCat
 * sınıfında (RC REST'ten okunur, SUNUCU-OTORİTER). Bkz App\Support\RevenueCat.
 */
class RevenueCatController extends Controller
{
    /** POST /iap/revenuecat/sync — giriş yapmış app kullanıcısı; satın alma sonrası + açılışta çağrılır. */
    public function sync(Request $request)
    {
        $u = $request->user();
        $r = RevenueCat::syncUser($u);
        $u->refresh();

        return response()->json([
            'ok' => $r['ok'],
            'premium' => $u->plan === 'premium' && $u->plan_until && $u->plan_until->isFuture(),
            'plan' => $u->plan,
            'plan_until' => $u->plan_until?->toIso8601String(),
        ]);
    }

    /**
     * POST /iap/revenuecat/coins — native coin (consumable) satın alma sonrası app çağırır. RC REST'ten
     * non_subscriptions SUNUCU-OTORİTER okunur, henüz kredilendirilmemiş satın almalar cüzdana eklenir
     * (idempotent). Döner: bu çağrıda eklenen coin + güncel bakiye.
     */
    public function coins(Request $request)
    {
        $u = $request->user();
        $granted = RevenueCat::fulfillCoins($u);
        $u->refresh();

        return response()->json([
            'ok' => true,
            'granted' => $granted,
            'coins' => (int) $u->coins,
        ]);
    }

    /**
     * POST /iap/revenuecat/webhook — RC sunucudan yenileme/iptal/süre-dolumu push'u. Authorization
     * header RC panelinde girdiğimiz paylaşılan sır ile EŞLEŞMELİ (hash_equals). Gövdeye GÜVENMEYİZ:
     * yalnız app_user_id'yi alıp RC'den TAZE çekip uygularız.
     */
    public function webhook(Request $request)
    {
        $expected = (string) config('services.revenuecat.webhook_auth');
        if ($expected === '' || ! hash_equals($expected, (string) $request->header('Authorization'))) {
            return response()->json(['ok' => false], 401);
        }

        $appUserId = (string) $request->input('event.app_user_id', '');
        if ($appUserId !== '' && ctype_digit($appUserId)) {
            try {
                RevenueCat::syncByAppUserId($appUserId);
            } catch (\Throwable $e) {
                Log::warning('revenuecat webhook sync hata', ['app_user_id' => $appUserId, 'err' => $e->getMessage()]);
            }
        }

        return response()->json(['ok' => true]);
    }
}
