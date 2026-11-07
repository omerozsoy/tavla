<?php

namespace App\Support;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * RevenueCat REST ile Premium üyelik senkronu — SUNUCU-OTORİTER. Client (app) yalnız satın almayı
 * NATIVE paywall'da tamamlar; premium'u VERMEK/ALMAK burada, RC'nin abone durumundan okunur
 * (client'a GÜVENİLMEZ). Çağrı iki yoldan: (1) /iap/revenuecat/sync (app satın alma sonrası + açılışta),
 * (2) /iap/revenuecat/webhook (yenileme/iptal/süre dolumu RC push'u). İkisi de aynı: RC'den TAZE çek, uygula.
 *
 * app_user_id = bizim users.id (app Purchases.configure/logIn ile bunu set eder) -> RC aboneliği
 * doğru kullanıcıya bağlanır. Premium KAYNAĞI 'revenuecat' damgalanır; süre dolunca YALNIZ bu kaynaklı
 * premium düşürülür (kartla ödenmiş premium'a dokunulmaz).
 */
class RevenueCat
{
    private const API = 'https://api.revenuecat.com/v1/subscribers/';

    public static function configured(): bool
    {
        return (string) config('services.revenuecat.secret_key') !== '';
    }

    /**
     * Kullanıcının RC abone durumunu çek, Premium'u uygula. Döner: ['premium'=>bool, 'until'=>?string].
     * RC erişilemezse/yapılandırılmamışsa kullanıcıya DOKUNMAZ (mevcut durum korunur).
     */
    public static function syncUser(User $u): array
    {
        if (! self::configured()) {
            return ['premium' => null, 'until' => null, 'ok' => false];
        }

        $ent = config('services.revenuecat.entitlement', 'tavlatv_premium');
        try {
            $res = Http::withToken((string) config('services.revenuecat.secret_key'))
                ->acceptJson()
                ->timeout(10)
                ->get(self::API.rawurlencode((string) $u->id));
        } catch (\Throwable $e) {
            Log::warning('revenuecat: REST erişilemedi', ['user' => $u->id, 'err' => $e->getMessage()]);

            return ['premium' => null, 'until' => null, 'ok' => false];
        }

        if ($res->status() === 404) {
            // RC bu app_user_id'yi hiç görmedi (satın alma yok) -> aktif değil.
            self::applyInactive($u);

            return ['premium' => false, 'until' => null, 'ok' => true];
        }
        if (! $res->successful()) {
            Log::warning('revenuecat: REST hata', ['user' => $u->id, 'status' => $res->status()]);

            return ['premium' => null, 'until' => null, 'ok' => false];
        }

        $entitlement = data_get($res->json(), "subscriber.entitlements.$ent");
        if (! $entitlement) {
            self::applyInactive($u);

            return ['premium' => false, 'until' => null, 'ok' => true];
        }

        // expires_date null = ömür boyu (lifetime); dolu = abonelik bitişi. Aktif = süresiz VEYA gelecekte.
        $expires = data_get($entitlement, 'expires_date');
        $until = $expires ? Carbon::parse($expires) : null;
        $active = $until === null || $until->isFuture();

        if ($active) {
            self::applyActive($u, $until);

            return ['premium' => true, 'until' => $until?->toIso8601String(), 'ok' => true];
        }
        self::applyInactive($u);

        return ['premium' => false, 'until' => null, 'ok' => true];
    }

    /** Webhook/sync gövdesindeki app_user_id'den kullanıcıyı bul ve senkronla. */
    public static function syncByAppUserId(string $appUserId): void
    {
        $u = User::find((int) $appUserId);
        if ($u) {
            self::syncUser($u);
        }
    }

    private static function applyActive(User $u, ?Carbon $until): void
    {
        $u->plan = 'premium';
        // Lifetime (süresiz) -> uzak gelecek; abonelik -> RC bitişi (OTORİTER, +ay/+yıl TAHMİNİ DEĞİL).
        $u->plan_until = $until ?? now()->addYears(100);
        if (! $u->plan_since) {
            $u->plan_since = now();
        }
        $u->auto_renew = $until !== null; // lifetime yenilenmez
        $u->stampPlanSource('revenuecat');
        $u->save();
    }

    /** Aktif değil: YALNIZ RC-kaynaklı premium'u düşür (kartla ödenmişe dokunma). */
    private static function applyInactive(User $u): void
    {
        if (($u->plan_source ?? null) !== 'revenuecat') {
            return;
        }
        if ($u->plan === 'free') {
            return;
        }
        $u->plan = 'free';
        $u->plan_until = now();
        $u->auto_renew = false;
        $u->save();
    }
}
