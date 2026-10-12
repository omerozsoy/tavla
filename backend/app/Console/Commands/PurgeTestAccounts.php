<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * E-posta desenine uyan TEST hesaplarini (ve FK-cascade ile mac/blunder/vb. kayitlarini) siler.
 *
 * Amac: uctan-uca PR/otoriterlik testleri sirasinda acilan throwaway hesaplarin (or.
 * prtest_*@example.com) canlida birikmesini temizlemek. Kullanici silme AuthController::
 * deleteAccount ile AYNI sozlesme: kulup sahipligi nazik devir + notifications/tokens elle,
 * match_results/blunders/... FK cascadeOnDelete ile otomatik.
 *
 * İKİ MOD:
 *  - VARSAYILAN: UserEraser::erase -> mali gecmisi (coin defteri/odeme/siparis) olan hesap
 *    ANONIMLESTIRILIR (yasal saklama; satir kalir ama panelde gizli).
 *  - --hard: KALICI FIZIKSEL SIL — mali kayitlar DA silinir (withoutFinancialDeleteGuard).
 *    YALNIZ SENTETIK TEST VERISI icin. Gercek kullanicida yasal/mali kayit kaybi olur.
 *
 * GUVENLIK: varsayilan DRY-RUN (yalniz listeler). Silmek icin --force sart. Admin (is_admin)
 * hesaplar ASLA silinmez. Desen daraltilmadan '%' gibi genel bir sey verilemez.
 *
 * Kullanim (sunucuda):
 *   php artisan tavla:purge-test-accounts                                   # dry-run
 *   php artisan tavla:purge-test-accounts --force                           # anonimlestir/sil
 *   php artisan tavla:purge-test-accounts --email='prtest_%@example.com' --hard --force  # KALICI sil
 */
class PurgeTestAccounts extends Command
{
    protected $signature = 'tavla:purge-test-accounts '
        .'{--email=prtest_%@example.com : Silinecek hesaplarin email LIKE deseni} '
        .'{--hard : KALICI fiziksel sil (mali kayitlar dahil) — yalniz sentetik test verisi} '
        .'{--force : Gercekten sil (yoksa dry-run)}';

    protected $description = 'E-posta desenine uyan test hesaplarini siler (dry-run varsayilan; --hard = kalici)';

    public function handle(): int
    {
        $pattern = (string) $this->option('email');
        $hard = (bool) $this->option('hard');
        // Guvenlik: cok genel desen (yalniz % / bos) kazara herkesi silmesin.
        $stripped = trim(str_replace('%', '', $pattern));
        if (mb_strlen($stripped) < 5) {
            $this->error("Desen fazla genel ('{$pattern}') — en az 5 sabit karakter iceren bir email deseni ver.");

            return self::FAILURE;
        }

        $users = \App\Models\User::where('email', 'like', $pattern)
            ->where(function ($q) {
                $q->whereNull('is_admin')->orWhere('is_admin', false);
            })
            ->get(['id', 'email', 'nickname']);

        if ($users->isEmpty()) {
            $this->info("Desene uyan (admin olmayan) hesap yok: {$pattern}");

            return self::SUCCESS;
        }

        $this->info("Desen: {$pattern} — bulunan hesap: {$users->count()}".($hard ? '  [KALICI SIL MODU]' : ''));
        foreach ($users as $u) {
            $matches = DB::table('match_results')->where('user_id', $u->id)->count();
            $fin = self::financialCount($u->id);
            $this->line("  #{$u->id}  {$u->email}  ({$u->nickname})  mac_kaydi={$matches}  mali_kayit={$fin}");
        }

        if ($hard) {
            $this->warn('!!! --hard: mali kayitlar (coin defteri/odeme/siparis) KALICI silinecek. '
                .'Bunu YALNIZ sentetik test hesaplari icin kullan — gercek kullanicida yasal kayit kaybi olur.');
        }

        if (! $this->option('force')) {
            $this->warn('dry-run: hicbir sey silinmedi. Silmek icin --force ekle'.($hard ? ' (--hard zaten verildi).' : '.'));

            return self::SUCCESS;
        }

        $deleted = 0;
        $anonymized = 0;
        foreach ($users as $u) {
            $user = \App\Models\User::find($u->id);
            if (! $user) {
                continue;
            }
            if ($hard) {
                // KALICI: mali kayitlari da sil -> hasFinancialHistory false olur -> UserEraser fiziksel siler.
                // withoutFinancialDeleteGuard: model deleting-guard'ini sentetik veri icin devre disi birak.
                \App\Models\User::withoutFinancialDeleteGuard(function () use ($user) {
                    foreach (['wallet_transactions', 'payments', 'product_orders'] as $t) {
                        if (Schema::hasTable($t)) {
                            DB::table($t)->where('user_id', $user->id)->delete();
                        }
                    }
                    \App\Support\UserEraser::erase($user);
                });
                $deleted++;
            } else {
                // Varsayilan: mali gecmis varsa UserEraser anonimlestirir, yoksa fiziksel siler.
                $hadFin = $user->hasFinancialHistory();
                \App\Support\UserEraser::erase($user);
                $hadFin ? $anonymized++ : $deleted++;
            }
        }

        if ($hard) {
            $this->info("KALICI silindi: {$deleted} test hesabi (mali kayitlar + mac/blunder FK-cascade ile).");
        } else {
            $this->info("Islendi: {$deleted} fiziksel silindi, {$anonymized} anonimlestirildi (mali kayit).");
        }

        return self::SUCCESS;
    }

    private static function financialCount(int $userId): int
    {
        $n = 0;
        foreach (['wallet_transactions', 'payments', 'product_orders'] as $t) {
            if (Schema::hasTable($t)) {
                $n += DB::table($t)->where('user_id', $userId)->count();
            }
        }

        return $n;
    }
}
