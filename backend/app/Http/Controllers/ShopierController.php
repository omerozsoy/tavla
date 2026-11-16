<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Support\Shopier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Shopier hosted ödeme akışı. redirect(): kullanıcıyı imzalı formla Shopier'in sayfasına POST eder;
 * callback(): Shopier'in server-to-server ödeme sonucunu imza doğrulayıp ödemeyi settle eder.
 * Gerçek fulfillment (coin/premium/ürün/turnuva) PaymentController::settle -> fulfillPayment'ta.
 */
class ShopierController extends Controller
{
    // GET /pay/shopier/{order} — kullanıcı tarayıcısı buraya yönlenir (checkout response'taki redirect).
    // PENDING ödeme bulunur, imzalı Shopier formu auto-submit view ile hosted sayfaya gönderilir.
    // Secret SUNUCUDA kalır. order_id tahmin edilemez (timestamp + random) -> ayrı auth gerekmez.
    public function redirect(string $order)
    {
        if (! Shopier::enabled()) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }
        $payment = Payment::where('order_id', $order)->where('status', 'pending')->first();
        if (! $payment || ! $payment->user) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }

        return response()->view('pay.shopier', [
            'action' => Shopier::PAY_URL,
            'fields' => Shopier::payForm($payment, $payment->user, route('pay.shopier.callback')),
        ]);
    }

    // POST /api/pay/shopier/callback — Shopier server-to-server ödeme sonucu (CSRF'siz; imzayla doğrulanır).
    // Başarılıysa ödeme ATOMİK settle (idempotent: çift callback coin'i iki kez vermez). Kullanıcı
    // (tarayıcı yönlendirmesi geldiyse) /pay/result'a döner.
    public function callback(Request $request)
    {
        $d = $request->all();
        if (! Shopier::verifyCallback($d)) {
            Log::warning('shopier callback imza geçersiz', ['order' => $d['platform_order_id'] ?? null]);

            return redirect()->route('pay.result', ['ok' => 0]);
        }

        $order = (string) ($d['platform_order_id'] ?? '');
        $status = (string) ($d['status'] ?? '');
        $payment = Payment::where('order_id', $order)->first();
        if (! $payment) {
            return redirect()->route('pay.result', ['ok' => 0]);
        }

        if ($status !== 'success') {
            if ($payment->status === 'pending') {
                $payment->status = 'failed';
                $payment->bank_msg = 'shopier: '.($status ?: 'failed');
                $payment->save();
            }

            return redirect()->route('pay.result', ['ok' => 0]);
        }

        app(PaymentController::class)->settle($payment, 'shopier:'.($d['payment_id'] ?? ''));

        return redirect()->route('pay.result', ['ok' => 1]);
    }
}
