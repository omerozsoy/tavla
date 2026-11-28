<?php

namespace App\Console\Commands;

use App\Models\Payment;
use Illuminate\Console\Command;

/**
 * N günden (varsayılan 3) fazla "Bekliyor" (pending) kalan ödeme kayıtlarını siler.
 *
 * Havale/kart onaylanmazsa (admin "paid" yapmaz) kayıt ölü ağırlıktır -> /admin/payments listesi
 * birikir. SADECE status=pending silinir; 'paid' ASLA silinmez (muhasebe/erişim kaydı korunur).
 *
 *   php artisan payments:prune-pending            # sil (varsayılan 3 gün)
 *   php artisan payments:prune-pending --days=7
 *   php artisan payments:prune-pending --dry-run  # sadece say
 */
class PrunePendingPayments extends Command
{
    protected $signature = 'payments:prune-pending
        {--days=3 : Bu kadar günden eski BEKLEYEN ödemeler silinir}
        {--dry-run : Sadece say, silme}';

    protected $description = '3 günden fazla "Bekliyor" kalan ödeme kayıtlarını siler (paid asla silinmez).';

    public function handle(): int
    {
        $days = max(0, (int) $this->option('days'));
        $q = Payment::where('status', 'pending')->where('created_at', '<', now()->subDays($days));

        if ($this->option('dry-run')) {
            $this->info('Silinecek: '.$q->count().' bekleyen ödeme (>'.$days.' gün).');

            return self::SUCCESS;
        }

        $n = $q->delete();
        $this->info("Bekleyen ödeme budandı: {$n} kayıt silindi (>{$days} gün).");

        return self::SUCCESS;
    }
}
