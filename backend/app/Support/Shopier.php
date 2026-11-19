<?php

namespace App\Support;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Shopier REST API v1 (PAT / Kişisel Erişim Anahtarı) entegrasyonu. Kart verisini BİZ TOPLAMAYIZ:
 * her ödeme için Shopier'de tek-seferlik bir "ürün" oluşturulur, kullanıcı o ürünün Shopier hosted
 * ödeme sayfasına yönlendirilir (3DS + PCI Shopier'de). Ödeme olunca Shopier webhook'u çağırır;
 * imza doğrulanır, sipariş Shopier'den TEKRAR okunur (gövdeye güvenmeyiz), 'paid' ise ödeme atomik
 * settle edilir (bkz ShopierController + PaymentController::settle -> fulfillPayment).
 *
 * ⚠ VERIFY: Shopier resmi API v1 dökümanı herkese açık DEĞİL. Aşağıdaki base URL / path'ler / alan
 * adları topluluk şablonundan (kefy266/shopier-pat-template) alındı. CANLIYA ALMADAN ÖNCE Shopier
 * geliştirici dökümanı veya 1 test ödemesiyle (gerçek yanıt JSON'u) doğrula. Eşleşmezse SADECE
 * `VERIFY` işaretli sabitler/alan adları değişir; akış (create -> redirect -> webhook -> re-read ->
 * settle) aynı kalır.
 */
class Shopier
{
    private const BASE = 'https://api.shopier.com/v1';   // VERIFY
    private const EP_PRODUCTS = '/products';             // VERIFY: ödeme ürünü oluştur (POST)
    private const EP_ORDER = '/orders/';                 // VERIFY: tek sipariş oku (GET /orders/{id})
    private const EP_WEBHOOKS = '/webhooks';             // VERIFY: webhook kaydı (POST)

    /** PAT dolu mu? Boşsa kart ödemesi KAPALI (checkout eski PENDING/elle-onay akışı). */
    public static function enabled(): bool
    {
        return trim((string) config('services.shopier.pat')) !== '';
    }

    private static function http()
    {
        return Http::baseUrl(self::BASE)
            ->withToken((string) config('services.shopier.pat'))
            ->acceptJson()
            ->timeout(15);
    }

    /**
     * Ödeme için tek-seferlik Shopier ürünü oluşturur. Döner: ['id' => productId, 'url' => ödemeLinki]
     * veya hata/kapalıysa null. $payment->amount KURUŞ; Shopier TL (float) ister.
     */
    public static function createPayment(Payment $payment): ?array
    {
        if (! self::enabled()) {
            return null;
        }
        $priceTry = round($payment->amount / 100, 2);
        try {
            $r = self::http()->post(self::EP_PRODUCTS, [
                'title' => self::productName($payment).' #'.$payment->order_id,
                'description' => 'TavlaTV '.$payment->order_id,
                'type' => 'digital',                                        // VERIFY: dijital ürün (kargo yok)
                'priceData' => ['currency' => 'TRY', 'price' => $priceTry], // VERIFY: alan adları
                'stockStatus' => 'inStock',
                'stockQuantity' => 1,
            ]);
        } catch (\Throwable $e) {
            Log::error('shopier createPayment istisna', ['order' => $payment->order_id, 'err' => $e->getMessage()]);

            return null;
        }
        if (! $r->successful()) {
            Log::error('shopier createPayment hata', ['order' => $payment->order_id, 'status' => $r->status(), 'body' => $r->body()]);

            return null;
        }
        $d = $r->json('data') ?? $r->json();                               // VERIFY: {data:{...}} mı düz mü
        $id = (string) ($d['id'] ?? '');
        $url = (string) ($d['url'] ?? $d['paymentUrl'] ?? '');             // VERIFY: ödeme linki alanı
        if ($id === '' || $url === '') {
            Log::error('shopier createPayment eksik id/url', ['order' => $payment->order_id, 'body' => $r->body()]);

            return null;
        }

        return ['id' => $id, 'url' => $url];
    }

    /** Siparişi Shopier'den TEKRAR okur (webhook gövdesine güvenmeyiz). Döner: order dizisi veya null. */
    public static function getOrder(string $orderId): ?array
    {
        if (! self::enabled() || $orderId === '') {
            return null;
        }
        try {
            $r = self::http()->get(self::EP_ORDER.$orderId);
        } catch (\Throwable $e) {
            Log::error('shopier getOrder istisna', ['order' => $orderId, 'err' => $e->getMessage()]);

            return null;
        }
        if (! $r->successful()) {
            return null;
        }

        return $r->json('data') ?? $r->json();
    }

    /**
     * Webhook imza doğrulaması. Shopier-Signature header'ı, webhook kaydında alınan token ile
     * HMAC-SHA256(rawBody). hex / base64 / url-safe base64 üç format da kabul (zamanlama-güvenli).
     */
    public static function verifyWebhook(string $rawBody, string $sigHeader): bool
    {
        $token = (string) config('services.shopier.webhook_token');
        if ($token === '' || trim($sigHeader) === '') {
            return false;
        }
        $sig = preg_replace('/^(sha256=|hmac-sha256=)/i', '', trim($sigHeader));
        $mac = hash_hmac('sha256', $rawBody, $token, true);

        return hash_equals(bin2hex($mac), strtolower($sig))
            || hash_equals(base64_encode($mac), $sig)
            || hash_equals(rtrim(strtr(base64_encode($mac), '+/', '-_'), '='), rtrim($sig, '='));
    }

    /** Siparişten Shopier product id'lerini çıkarır (hangi Payment'a ait eşleşmesi için). VERIFY: kalem yapısı. */
    public static function orderProductIds(array $order): array
    {
        $ids = [];
        foreach ((array) ($order['items'] ?? $order['lineItems'] ?? []) as $it) {
            $pid = $it['productId'] ?? $it['product_id'] ?? $it['id'] ?? null;
            if ($pid !== null) {
                $ids[] = (string) $pid;
            }
        }

        return $ids;
    }

    /** Sipariş ödendi mi? VERIFY: paymentStatus === 'paid'. */
    public static function orderPaid(array $order): bool
    {
        return strtolower((string) ($order['paymentStatus'] ?? $order['status'] ?? '')) === 'paid';
    }

    /** Webhook oluştur -> Shopier imza token'ını içeren yanıt (kurulum komutu .env'e yazdırır). null = kapalı. */
    public static function registerWebhook(string $callbackUrl): ?array
    {
        if (! self::enabled()) {
            return null;
        }
        $r = self::http()->post(self::EP_WEBHOOKS, [
            'url' => $callbackUrl,
            'events' => ['order.created'],   // VERIFY: olay adı
        ]);
        if (! $r->successful()) {
            return ['error' => $r->status().' '.$r->body()];
        }

        return $r->json('data') ?? $r->json();   // token alanı içinde (VERIFY: 'token'/'signatureKey'/'secret')
    }

    private static function productName(Payment $p): string
    {
        return match ($p->kind) {
            'coins', 'cart' => 'TavlaTV Coin / Ürün',
            'tournament_entry' => 'TavlaTV Turnuva Katılım',
            default => 'TavlaTV Ödeme',
        };
    }
}
