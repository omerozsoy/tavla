<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Models\User;
use App\Models\UserWxpTransaction;
use App\Services\WxpService;
use Illuminate\Console\Command;

/**
 * WXP ledger backfill + cached total rebuild. Production-safe:
 *  - chunkById ile batch (Match::all() YOK; bellek sabit).
 *  - Idempotent: mevcut ledger satirlarini atlar (ikinci kez calisirsa duplicate olusturmaz).
 *  - --dry-run: yazmadan kac transaction olusacagini gosterir.
 *  - --user=ID: tek kullanici (debug).
 *  - --rebuild-totals: ledger'a dokunmaz; yalniz users.total_wxp = SUM(ledger) yeniden uretir.
 *
 * Kullanim:
 *   php artisan stats:backfill-wxp
 *   php artisan stats:backfill-wxp --dry-run
 *   php artisan stats:backfill-wxp --user=128
 *   php artisan stats:backfill-wxp --rebuild-totals
 */
class BackfillWxp extends Command
{
    protected $signature = 'stats:backfill-wxp
        {--dry-run : Yazma yok; kac WXP transaction olusturulacagini goster}
        {--user= : Sadece bu user_id icin calis}
        {--rebuild-totals : Ledger degismez; yalniz cached users.total_wxp yeniden uretilir}';

    protected $description = 'Eski tamamlanmis maclar icin WXP ledger backfill + cached total rebuild (idempotent).';

    public function handle(WxpService $wxp): int
    {
        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;
        $dry = (bool) $this->option('dry-run');

        if ($this->option('rebuild-totals')) {
            $this->rebuildTotals($userId);

            return self::SUCCESS;
        }

        $base = MatchResult::query()->where('won', true);
        if ($userId !== null) {
            $base->where('user_id', $userId);
        }
        $total = (int) $base->count();
        $scope = ($userId !== null ? " [user={$userId}]" : '').($dry ? ' (DRY-RUN)' : '');
        $this->info("WXP backfill: {$total} kazanilmis mac taranacak{$scope}.");

        $processed = 0;
        $created = 0;
        $wxpSum = 0;

        $base->orderBy('id')->chunkById(1000, function ($rows) use ($wxp, $dry, &$processed, &$created, &$wxpSum, $total) {
            foreach ($rows as $mr) {
                $amount = $wxp->backfillMatchResult($mr, ! $dry);
                if ($amount > 0) {
                    $created++;
                    $wxpSum += $amount;
                }
                $processed++;
            }
            $this->line('Processed '.number_format($processed).' / '.number_format($total).' matches — '
                .number_format($created).' WXP tx'.($dry ? ' (planned)' : '').'.');
        });

        if ($dry) {
            $this->info("DRY-RUN: {$created} transaction olusturulacakti (toplam {$wxpSum} WXP). Veritabani DEGISMEDI.");

            return self::SUCCESS;
        }

        $this->info("Ledger yazildi: {$created} yeni transaction, {$wxpSum} WXP. Cached total_wxp yeniden uretiliyor...");
        $this->rebuildTotals($userId);
        $this->info('WXP backfill tamamlandi.');

        return self::SUCCESS;
    }

    /** Cached users.total_wxp'yi ledger SUM(amount) ile yeniden uret (kapsam: tumu ya da tek user). */
    private function rebuildTotals(?int $userId): void
    {
        // Once kapsamdaki total'leri sifirla (ledger'i olmayan kullanici 0 kalsin).
        User::query()->when($userId !== null, fn ($q) => $q->whereKey($userId))->update(['total_wxp' => 0]);

        $sums = UserWxpTransaction::query()->selectRaw('user_id, SUM(amount) as s')->groupBy('user_id');
        if ($userId !== null) {
            $sums->where('user_id', $userId);
        }
        $n = 0;
        foreach ($sums->get() as $row) {
            User::whereKey($row->user_id)->update(['total_wxp' => (int) $row->s]);
            $n++;
        }
        $this->info("Cached total_wxp yeniden uretildi ({$n} kullanici).");
    }
}
