<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Support\Shopier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Shopier REST API v1 (PAT) ödeme akışı. redirect(): pending ödeme için Shopier ürünü oluşturup
 * kullanıcıyı hosted ödeme sayfasına 302 yönlendirir. callback(): Shopier webhook'u (server-to-server)
 * imza doğrulanıp sipariş Shopier'den TEKRAR okunur, 'paid' ise ödeme settle edilir. Gerçek fulfillment
 * (coin/ürün/turnuva) PaymentController::settle -> fulfillPayment'ta (TEK nokta).
 */
class ShopierController extends Controller
{
    // GET /pay/shopier/{order} — kullanıcı tarayıcısı buraya yönlenir (checkout response'taki redirect).
    // Pending ödeme için Shopier ürünü oluştur, linkini kaydet, hosted sayfaya 302 at. Refresh'te
    // (url zaten varsa) YENİ ürün OLUŞTURMA -> aynı linke götür. PAT sunucuda kalır.
    public function redirect(string $order)
    {
        if (! Shopier::enabled()) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }
        $payment = Payment::where('order_id', $order)->where('status', 'pending')->first();
        if (! $payment || ! $payment->user) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }
        if ($payment->shopier_url) {
            return redirect()->away($payment->shopier_url);
        }
        $res = Shopier::createPayment($payment);
        if (! $res) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }
        $payment->shopier_product_id = $res['id'];
        $payment->shopier_url = $res['url'];
        $payment->save();

        return redirect()->away($res['url']);
    }

    // POST /api/pay/shopier/callback — Shopier webhook (server-to-server, CSRF'siz). Shopier-Signature
    // ile doğrulanır; gövdeye GÜVENİLMEZ -> sipariş API'den tekrar okunur. paymentStatus='paid' +
    // product id'si eşleşen pending Payment -> atomik settle (idempotent). Her durumda 200 (webhook ack).
    public function callback(Request $request)
    {
        $raw = $request->getContent();
        if (! Shopier::verifyWebhook($raw, (string) $request->header('Shopier-Signature', ''))) {
            Log::warning('shopier webhook imza geçersiz');

            return response()->json(['ok' => false], 403);
        }

        $body = (array) $request->json()->all();
        // VERIFY: webhook gövdesinde sipariş id alanı (gövde yalnız sipariş no verir, ayrıntı API'den).
        $orderId = (string) ($body['orderId'] ?? $body['order_id']
            ?? data_get($body, 'data.orderId') ?? data_get($body, 'data.id') ?? '');
        if ($orderId === '') {
            return response()->json(['ok' => true]); // tanınmayan olay -> ack, işlem yok
        }

        $shopierOrder = Shopier::getOrder($orderId);
        if (! $shopierOrder || ! Shopier::orderPaid($shopierOrder)) {
            return response()->json(['ok' => true]);
        }

        $productIds = Shopier::orderProductIds($shopierOrder);
        if (empty($productIds)) {
            Log::warning('shopier webhook: siparişte ürün id yok', ['order' => $orderId]);

            return response()->json(['ok' => true]);
        }

        $payment = Payment::whereIn('shopier_product_id', $productIds)
            ->where('status', 'pending')
            ->first();
        if ($payment) {
            app(PaymentController::class)->settle($payment, 'shopier:order:'.$orderId);
        }

        return response()->json(['ok' => true]);
    }
}
