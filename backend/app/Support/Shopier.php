<?php

namespace App\Support;

use App\Models\Payment;
use App\Models\User;

/**
 * Shopier hosted ödeme sayfası entegrasyonu. Kart verisini BİZ TOPLAMAYIZ — kullanıcı imzalı
 * formla Shopier'in kendi ödeme sayfasına POST edilir (3D Secure + PCI Shopier tarafında). Ödeme
 * sonrası Shopier, callback URL'imize imzalı server-to-server POST yapar; imza doğrulanınca ödeme
 * atomik settle edilir (bkz ShopierController + PaymentController::settle).
 *
 * İmza (Shopier API v4):
 *   - payForm signature  = base64(hmac_sha256(random_nr + order_id + amount + currency, secret))
 *   - callback signature = base64(hmac_sha256(random_nr + order_id, secret))
 * ponytail: formül Shopier API v4 (yaygın PrestaShop/OpenCart modülleri). Canlıya almadan ÖNCE
 * Shopier panel "Entegrasyon/API" dökümanıyla alan sırasını doğrula — yanlış imza = Shopier tüm
 * ödemeleri reddeder (güvenlik açığı DEĞİL, sadece çalışmaz).
 */
class Shopier
{
    /** Shopier ödeme formunun POST edileceği hosted endpoint (API v4). */
    public const PAY_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php';

    /** API key + secret dolu mu? Boşsa kart ödemesi KAPALI (checkout eski PENDING/elle-onay akışı). */
    public static function enabled(): bool
    {
        return trim((string) config('services.shopier.api_key')) !== ''
            && trim((string) config('services.shopier.api_secret')) !== '';
    }

    /** Shopier'e POST edilecek imzalı form alanları. $payment->amount KURUŞ; Shopier TL ("10.00") ister. */
    public static function payForm(Payment $payment, User $user, string $callbackUrl): array
    {
        $key = (string) config('services.shopier.api_key');
        $secret = (string) config('services.shopier.api_secret');
        $amount = number_format($payment->amount / 100, 2, '.', ''); // kuruş -> "49.90"
        $currency = 0;                                               // 0 = TRY
        $randomNr = (string) random_int(100000, 999999);
        $orderId = (string) $payment->order_id;

        $signature = base64_encode(hash_hmac('sha256', $randomNr.$orderId.$amount.$currency, $secret, true));

        $first = trim((string) ($user->first_name ?: $user->nickname ?: 'TavlaTV'));
        $last = trim((string) ($user->last_name ?: '-')) ?: '-';

        return [
            'API_key' => $key,
            'website_index' => (int) config('services.shopier.website_index', 1),
            'platform_order_id' => $orderId,
            'product_name' => self::productName($payment),
            'product_type' => 1,                         // 1 = dijital/sanal ürün (kargo yok)
            'buyer_name' => $first,
            'buyer_surname' => $last,
            'buyer_email' => (string) ($user->email ?: 'noemail@tavlatv.com'),
            'buyer_account_age' => 0,
            'buyer_id_nr' => (string) $user->id,
            'buyer_phone' => (string) ($user->phone ?? ''),
            'billing_address' => 'TavlaTV',
            'billing_city' => 'Istanbul',
            'billing_country' => 'Turkey',
            'billing_postcode' => '34000',
            'shipping_address' => 'TavlaTV',
            'shipping_city' => 'Istanbul',
            'shipping_country' => 'Turkey',
            'shipping_postcode' => '34000',
            'total_order_value' => $amount,
            'currency' => $currency,
            'platform' => 0,
            'is_in_frame' => 0,
            'current_language' => 0,                     // 0 = TR
            'modul_version' => '1.0.0',
            'random_nr' => $randomNr,
            'callback' => $callbackUrl,                  // Shopier paneline de aynı URL girilmeli
            'signature' => $signature,
        ];
    }

    /** Shopier callback gövdesinin imzası geçerli mi? (HMAC zamanlama-güvenli karşılaştırma.) */
    public static function verifyCallback(array $d): bool
    {
        $secret = (string) config('services.shopier.api_secret');
        $randomNr = (string) ($d['random_nr'] ?? '');
        $orderId = (string) ($d['platform_order_id'] ?? '');
        $signature = (string) ($d['signature'] ?? '');
        if ($randomNr === '' || $orderId === '' || $signature === '' || $secret === '') {
            return false;
        }
        $expected = base64_encode(hash_hmac('sha256', $randomNr.$orderId, $secret, true));

        return hash_equals($expected, $signature);
    }

    private static function productName(Payment $p): string
    {
        return match ($p->kind) {
            'coins', 'cart' => 'TavlaTV Coin / Ürün',
            'subscription', 'renew' => 'TavlaTV Premium Üyelik',
            'tournament_entry' => 'TavlaTV Turnuva Katılım',
            default => 'TavlaTV Ödeme',
        };
    }
}
