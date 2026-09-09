<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * "Oynanmadan olusan AI kaybi" (hayalet mac) kayitlarini siler.
 *
 * Belirti: Kullanici AI (pvb) macinda HIC hamle yapmadan "Mactan Cekil"e basinca,
 * eski surumlerde oynanmamis bir AI KAYBI kalici olarak "Mac Analizleri"ne yaziliyordu.
 * (Kok neden App.tsx pvb reportRating effect'inde giderildi; bu komut GECMIS satirlari temizler.)
 *
 * Hedefleme (dar ve guvenli):
 *   - room_code IS NULL  -> yalniz pvb/offline (online maclara DOKUNMAZ)
 *   - won = false        -> yalniz kayip (kazanilmis maclara DOKUNMAZ)
 *   - LENGTH(log) <= 40  -> bos/analizsiz log = hic oynanmamis (gercek AI maci daima loglu)
 *
 * Kullanim (sunucuda):
 *   php artisan tavla:purge-phantom-ai --email=kisi@site.com            # siler
 *   php artisan tavla:purge-phantom-ai --email=kisi@site.com --dry-run  # sadece listele
 *   php artisan tavla:purge-phantom-ai --user=42                        # id ile
 */
class PurgePhantomAiLoss extends Command
{
    protected $signature = 'tavla:purge-phantom-ai {--email= : Hesap e-postasi} {--user= : user_id} {--all : TUM kullanicilar} {--dry-run : Sadece listele, silme}';

    protected $description = 'Oynanmadan olusan hayalet AI kaybi kayitlarini siler (pvb + kayip + bos log)';

    public function handle(): int
    {
        $all = (bool) $this->option('all');
        $userId = $this->option('user') ? (int) $this->option('user') : null;

        if (! $all && ! $userId && $this->option('email')) {
            $u = DB::table('users')->where('email', $this->option('email'))->first();
            if (! $u) {
                $this->error('Kullanici bulunamadi: '.$this->option('email'));

                return self::FAILURE;
            }
            $userId = (int) $u->id;
        }

        if (! $all && ! $userId) {
            $this->error('--email, --user veya --all gerekli.');

            return self::FAILURE;
        }

        // Dar filtre: yalniz pvb (room_code NULL) + kayip + bos/analizsiz log.
        // --all degilse tek kullaniciya kisitla.
        $base = function () use ($all, $userId) {
            $q = DB::table('match_results')
                ->whereNull('room_code')
                ->where('won', false)
                ->whereRaw("LENGTH(COALESCE(log, '')) <= 40");
            if (! $all) {
                $q->where('user_id', $userId);
            }

            return $q;
        };

        $scope = $all ? 'TUM SITE' : 'user_id='.$userId;
        $count = $base()->count();

        if ($count === 0) {
            $this->info("Hayalet AI kaybi kaydi bulunmadi ({$scope}).");

            return self::SUCCESS;
        }

        $this->info("Hayalet AI kaybi adaylari ({$scope}): {$count} kayit");
        // Cok sayida olabilecegi icin en fazla 20 ornek goster.
        foreach ($base()->orderByDesc('id')->limit(20)->get() as $r) {
            $this->line(sprintf(
                '  id=%d | user=%d | created=%s | opp=%s | loglen=%d',
                $r->id,
                $r->user_id,
                $r->created_at ?? '?',
                $r->opponent_name ?? '?',
                strlen($r->log ?? '')
            ));
        }
        if ($count > 20) {
            $this->line('  ... ve '.($count - 20).' kayit daha');
        }

        if ($this->option('dry-run')) {
            $this->line("dry-run: hicbir kayit silinmedi. ({$count} aday)");

            return self::SUCCESS;
        }

        $deleted = $base()->delete();
        $this->info("Silindi: {$deleted} hayalet AI kaybi kaydi ({$scope}).");

        return self::SUCCESS;
    }
}
