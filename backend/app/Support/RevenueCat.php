<?php

namespace App\Support;

use App\Models\CoinPackage;
use App\Models\Payment;
use App\Models\User;
use App\Services\WalletService;
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

    /** Webhook/sync gövdesindeki app_user_id'den kullanıcıyı bul ve senkronla (premium + coin). */
    public static function syncByAppUserId(string $appUserId): void
    {
        $u = User::find((int) $appUserId);
        if ($u) {
            self::syncUser($u);
            self::fulfillCoins($u);
        }
    }

    /**
     * Tüketilir coin paketleri (consumable) — SUNUCU-OTORİTER kredilendirme. RC REST'ten
     * non_subscriptions okunur; config'deki coin_products haritasında olan HER satın alma transaction'ı
     * için cüzdana coin eklenir. Idempotent: WalletService replay anahtarı 'rc_coin:<transaction_id>'
     * → aynı satın alma İKİNCİ KEZ coin VERMEZ (sync + webhook aynı tx'i görse bile). Client "kaç coin"
     * demez; miktar config'den gelir, haritada olmayan ürün atlanır. Döner: bu çağrıda EKLENEN coin.
     */
    public static function fulfillCoins(User $u): int
    {
        if (! self::configured()) {
            return 0;
        }
        $map = (array) config('services.revenuecat.coin_products', []);
        if (! $map) {
            return 0;
        }

        try {
            $res = Http::withToken((string) config('services.revenuecat.secret_key'))
                ->acceptJson()
                ->timeout(10)
                ->get(self::API.rawurlencode((string) $u->id));
        } catch (\Throwable $e) {
            Log::warning('revenuecat: coin REST erişilemedi', ['user' => $u->id, 'err' => $e->getMessage()]);

            return 0;
        }
        if (! $res->successful()) {
            // 404 = RC bu kullanıcıyı görmedi (satın alma yok) -> verilecek coin yok.
            return 0;
        }

        $nonSubs = (array) data_get($res->json(), 'subscriber.non_subscriptions', []);
        $wallet = app(WalletService::class);
        $granted = 0;
        foreach ($nonSubs as $productId => $txns) {
            $coins = $map[$productId] ?? null;
            if (! $coins || ! is_array($txns)) {
                continue; // haritada olmayan/tanımsız ürün -> coin verme (güvenlik)
            }
            foreach ($txns as $txn) {
                $tid = (string) (data_get($txn, 'id') ?? data_get($txn, 'store_transaction_id') ?? '');
                if ($tid === '') {
                    continue;
                }
                $before = (int) ($u->coins ?? 0);
                $wallet->credit($u, (int) $coins, 'iap_coin_purchase', 'revenuecat', null, 'rc_coin:'.$tid);
                $granted += max(0, (int) ($u->coins ?? 0) - $before);

                // Admin görünürlüğü: her IAP satın almasını "Ödemeler"e (Payment) de yaz. order_id
                // 'iap_<tx>' UNIQUE -> idempotent (sync+webhook aynı tx'i görse de tek sipariş). TL
                // tutarı coin_packages'tan (Play'de ödenen gerçek fiyatın karşılığı). Koşulsuz: coin
                // kredisi idempotent ama Payment ayrı anahtar -> geçmiş satış da sonraki sync'te yazılır.
                $slug = substr($productId, 5); // 'coin_baslangic' -> 'baslangic'
                $price = (int) (CoinPackage::query()->where('slug', $slug)->value('price') ?? 0);
                Payment::query()->firstOrCreate(
                    ['order_id' => 'iap_'.$tid],
                    [
                        'user_id' => $u->id,
                        'kind' => 'coins',
                        'payment_method' => 'google_play',
                        'amount' => $price,
                        'coins' => (int) $coins,
                        'package_id' => $slug,
                        'currency' => '949',
                        'status' => 'paid',
                    ]
                );
            }
        }

        return $granted;
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
