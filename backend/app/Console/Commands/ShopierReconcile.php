<?php

namespace App\Console\Commands;

use App\Http\Controllers\PaymentController;
use App\Models\Payment;
use App\Support\Shopier;
use Illuminate\Console\Command;

/**
 * Shopier'de ödenmiş ama bizde PENDING kalan ödemeleri webhook'tan BAĞIMSIZ settle eder. Shopier
 * webhook teslimatı güvenilmez (gözlemlendi: ödeme başarılı, webhook hiç gelmedi) — bu yüzden
 * dakikada bir Shopier siparişlerini çekip paymentStatus='paid' + product_id eşleşen pending
 * Payment'ı settle ederiz. settle idempotent -> webhook DE gelirse coin iki kez verilmez.
 */
class ShopierReconcile extends Command
{
    protected $signature = 'shopier:reconcile';

    protected $description = 'Shopier ödenmiş siparişleri webhook\'tan bağımsız settle eder (yedek fulfillment)';

    public function handle(): int
    {
        if (! Shopier::enabled()) {
            return self::SUCCESS;
        }
        // Son 3 günün bekleyen Shopier ödemeleri: product_id -> Payment (webhook ulaşmamış olabilir).
        $pending = Payment::whereNotNull('shopier_product_id')
            ->where('status', 'pending')
            ->where('created_at', '>=', now()->subDays(3))
            ->get()
            ->keyBy('shopier_product_id');
        if ($pending->isEmpty()) {
            return self::SUCCESS;
        }

        $settled = 0;
        foreach (Shopier::listOrders(100) as $order) {
            if (! is_array($order) || ! Shopier::orderPaid($order)) {
                continue;
            }
            foreach (Shopier::orderProductIds($order) as $pid) {
                $p = $pending[$pid] ?? null;
                if ($p && app(PaymentController::class)->settle($p, 'shopier:reconcile:'.($order['id'] ?? ''))) {
                    $settled++;
                    $pending->forget($pid);
                }
            }
        }
        if ($settled > 0) {
            $this->info("shopier:reconcile: {$settled} ödeme settle edildi.");
        }

        return self::SUCCESS;
    }
}
