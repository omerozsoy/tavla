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
    protected $signature = 'tavla:purge-phantom-ai {--email= : Hesap e-postasi} {--user= : user_id} {--dry-run : Sadece listele, silme}';

    protected $description = 'Oynanmadan olusan hayalet AI kaybi kayitlarini siler (pvb + kayip + bos log)';

    public function handle(): int
    {
        $userId = $this->option('user') ? (int) $this->option('user') : null;

        if (! $userId && $this->option('email')) {
            $u = DB::table('users')->where('email', $this->option('email'))->first();
            if (! $u) {
                $this->error('Kullanici bulunamadi: '.$this->option('email'));

                return self::FAILURE;
            }
            $userId = (int) $u->id;
        }

        if (! $userId) {
            $this->error('--email veya --user gerekli.');

            return self::FAILURE;
        }

        // Dar filtre: yalniz pvb (room_code NULL) + kayip + bos/analizsiz log.
        $base = fn () => DB::table('match_results')
            ->where('user_id', $userId)
            ->whereNull('room_code')
            ->where('won', false)
            ->whereRaw("LENGTH(COALESCE(log, '')) <= 40");

        $rows = $base()->orderByDesc('id')->get();

        if ($rows->isEmpty()) {
            $this->info('Hayalet AI kaybi kaydi bulunmadi (user_id='.$userId.').');

            return self::SUCCESS;
        }

        $this->info('Hayalet AI kaybi adaylari (user_id='.$userId.'):');
        foreach ($rows as $r) {
            $this->line(sprintf(
                '  id=%d | created=%s | opp=%s | loglen=%d',
                $r->id,
                $r->created_at ?? '?',
                $r->opponent_name ?? '?',
                strlen($r->log ?? '')
            ));
        }

        if ($this->option('dry-run')) {
            $this->line('dry-run: hicbir kayit silinmedi. ('.$rows->count().' aday)');

            return self::SUCCESS;
        }

        $deleted = $base()->delete();
        $this->info("Silindi: {$deleted} hayalet AI kaybi kaydi.");

        return self::SUCCESS;
    }
}
