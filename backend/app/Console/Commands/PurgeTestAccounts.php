<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * E-posta desenine uyan TEST hesaplarini (ve FK-cascade ile mac/blunder/vb. kayitlarini) siler.
 *
 * Amac: uctan-uca PR/otoriterlik testleri sirasinda acilan throwaway hesaplarin (or.
 * prtest_*@example.com) canlida birikmesini temizlemek. Kullanici silme AuthController::
 * deleteAccount ile AYNI sozlesme: kulup sahipligi nazik devir + notifications/tokens elle,
 * match_results/blunders/... FK cascadeOnDelete ile otomatik.
 *
 * GUVENLIK: varsayilan DRY-RUN (yalniz listeler). Silmek icin --force sart. Admin (is_admin)
 * hesaplar ASLA silinmez. Desen daraltilmadan '%' gibi genel bir sey verilemez.
 *
 * Kullanim (sunucuda):
 *   php artisan tavla:purge-test-accounts                         # dry-run, varsayilan desen
 *   php artisan tavla:purge-test-accounts --force                 # sil
 *   php artisan tavla:purge-test-accounts --email='prtest_%@example.com' --force
 */
class PurgeTestAccounts extends Command
{
    protected $signature = 'tavla:purge-test-accounts '
        .'{--email=prtest_%@example.com : Silinecek hesaplarin email LIKE deseni} '
        .'{--force : Gercekten sil (yoksa dry-run)}';

    protected $description = 'E-posta desenine uyan test hesaplarini ve iliskili kayitlarini siler (dry-run varsayilan)';

    public function handle(): int
    {
        $pattern = (string) $this->option('email');
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

        $this->info("Desen: {$pattern} — bulunan hesap: {$users->count()}");
        foreach ($users as $u) {
            $matches = DB::table('match_results')->where('user_id', $u->id)->count();
            $this->line("  #{$u->id}  {$u->email}  ({$u->nickname})  mac_kaydi={$matches}");
        }

        if (! $this->option('force')) {
            $this->warn('dry-run: hicbir sey silinmedi. Silmek icin --force ekle.');

            return self::SUCCESS;
        }

        $deleted = 0;
        foreach ($users as $u) {
            $user = \App\Models\User::find($u->id);
            if (! $user) {
                continue;
            }
            // Silme sozlesmesi (kulup nazik devir + notifications/tokens + cascade) TEK kaynaktan:
            // UserEraser (deleteAccount ve admin coklu-silme ile ayni).
            \App\Support\UserEraser::erase($user);
            $deleted++;
        }

        $this->info("Silindi: {$deleted} test hesabi (iliskili mac/blunder kayitlari FK-cascade ile).");

        return self::SUCCESS;
    }
}
