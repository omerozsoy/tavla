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
 *   - log'da INSAN hamlesi YOK -> hic oynanmamis. Insan rengi = log.hc (pvb'de 'white').
 *     Log'da player===hc olan HIC girdi yoksa insan tek hamle bile yapmamistir.
 *     NOT: Eski "LENGTH(log)<=40" sezgisi YETERSIZDI: acilis zari bota (siyah) baslama
 *     hakki verirse bot ONCE oynar -> log botun hamlesiyle DOLAR (>40) ama insan yine hic
 *     oynamamistir. JSON parse ile bu durum da yakalanir (bos-log durumunun ust kumesi).
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

        // Dar SQL on-filtresi: yalniz pvb (room_code NULL) + kayip. Kesin hayalet karari
        // (log'da insan hamlesi yok) JSON parse ile PHP'de verilir -> tek DELETE portable degil.
        $sql = function () use ($all, $userId) {
            $q = DB::table('match_results')
                ->whereNull('room_code')
                ->where('won', false);
            if (! $all) {
                $q->where('user_id', $userId);
            }

            return $q;
        };

        $scope = $all ? 'TUM SITE' : 'user_id='.$userId;

        // Aday satirlari cek, log'u parse et: INSAN (player===hc) hic oynamamissa hayalet.
        $phantoms = [];
        foreach ($sql()->select('id', 'user_id', 'created_at', 'opponent_name', 'log')->orderByDesc('id')->get() as $r) {
            if ($this->humanNeverMoved($r->log)) {
                $phantoms[] = $r;
            }
        }

        $count = count($phantoms);
        if ($count === 0) {
            $this->info("Hayalet AI kaybi kaydi bulunmadi ({$scope}).");

            return self::SUCCESS;
        }

        $this->info("Hayalet AI kaybi adaylari ({$scope}): {$count} kayit");
        foreach (array_slice($phantoms, 0, 20) as $r) {
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

        $ids = array_map(fn ($r) => $r->id, $phantoms);
        $deleted = DB::table('match_results')->whereIn('id', $ids)->delete();
        $this->info("Silindi: {$deleted} hayalet AI kaybi kaydi ({$scope}).");

        return self::SUCCESS;
    }

    /**
     * Log JSON'unda INSAN (player === hc) HIC hamle yapmamis mi? Insan rengi = log.hc
     * (pvb'de daima 'white'). Bir tek insan girdisi bile varsa hayalet DEGILDIR (guvenli).
     * Bozuk/eksik log = insan yok say -> hayalet (bos-log durumu da buraya duser).
     */
    private function humanNeverMoved(?string $log): bool
    {
        $data = json_decode((string) $log, true);
        if (! is_array($data)) {
            return true; // parse edilemeyen/bos log = oynanmamis
        }
        $hc = in_array($data['hc'] ?? null, ['white', 'black'], true) ? $data['hc'] : 'white';
        $entries = is_array($data['log'] ?? null) ? $data['log'] : [];
        foreach ($entries as $e) {
            if (is_array($e) && ($e['player'] ?? null) === $hc) {
                return false; // insan en az bir tur oynamis -> gercek mac
            }
        }

        return true;
    }
}
