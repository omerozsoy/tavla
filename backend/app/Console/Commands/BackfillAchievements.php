<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Models\Notification;
use App\Models\Tournament;
use App\Models\User;
use App\Models\UserStat;
use App\Services\Achievements\AchievementService;
use App\Services\Achievements\MatchContext;
use App\Services\Achievements\StatsUpdater;
use Illuminate\Console\Command;

/**
 * Retroaktif basarim backfill: mevcut oyuncularin gecmis performansindan hak ettikleri
 * rozetleri verir + user_stats sayaclarini yeniden kurar. Production-safe:
 *  - Idempotent: unique(user_id,slug) sayesinde ikinci calistirma yeni rozet acmaz.
 *  - SESSIZ + COIN VERMEZ (award=false): 30 popup yerine kullaniciya TEK ozet bildirim.
 *  - Ranked mac gecmisini kronolojik replay eder (seri/zar/kup/best-move sayaclari dogru kurulur).
 *  - --dry-run: yazmadan kac rozet acilacagini gosterir.  --user=ID: tek kullanici.
 *
 * NOT (sema kisiti): mars/katmerli mars ve lifetime coin gecmiste kayitli DEGIL
 *  -> bunlar ileri-donuk izlenir; backfill mars sayaci 0'dan baslar (dokumante).
 *
 * Kullanim:
 *   php artisan achievements:backfill
 *   php artisan achievements:backfill --dry-run
 *   php artisan achievements:backfill --user=128
 */
class BackfillAchievements extends Command
{
    protected $signature = 'achievements:backfill
        {--dry-run : Yazma yok; kac rozet acilacagini goster}
        {--user= : Sadece bu user_id icin calis}
        {--notify : Ozet bildirim gonder (varsayilan: gonderir; --no-notify ile kapat)}';

    protected $description = 'Eski oyunculara gecmis performanslarindan hak ettikleri rozetleri ver (sessiz, idempotent).';

    public function handle(StatsUpdater $updater, AchievementService $svc): int
    {
        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;
        $dry = (bool) $this->option('dry-run');
        $notify = $this->option('notify') !== false; // varsayilan true

        $q = User::query()->when($userId !== null, fn ($x) => $x->whereKey($userId));
        $total = (int) $q->count();
        $this->info("Achievement backfill: {$total} kullanici".($dry ? ' (DRY-RUN)' : '').'.');

        $touched = 0;
        $awarded = 0;

        $q->orderBy('id')->chunkById(200, function ($users) use ($updater, $svc, $dry, $notify, &$touched, &$awarded) {
            foreach ($users as $user) {
                $count = $this->backfillUser($user, $updater, $svc, $dry);
                $touched++;
                if ($count > 0) {
                    $awarded += $count;
                    if (! $dry && $notify) {
                        Notification::notify(
                            $user->id,
                            'Rozetler açıldı!',
                            "Geçmiş performansından {$count} rozet kazandın.",
                            'medal'
                        );
                    }
                }
                $this->line("user #{$user->id}: {$count} rozet".($dry ? ' (planlanan)' : '').'.');
            }
        });

        $this->info(($dry ? 'DRY-RUN: ' : '')."{$touched} kullanici tarandi, {$awarded} rozet"
            .($dry ? ' acilacakti.' : ' acildi.'));

        return self::SUCCESS;
    }

    /** Tek kullaniciyi replay et + degerlendir. @return int yeni acilan rozet sayisi */
    private function backfillUser(User $user, StatsUpdater $updater, AchievementService $svc, bool $dry): int
    {
        // Sayaclari temiz kur: mevcut stat satirini sifirla (unlock'lara DOKUNMA — idempotency).
        UserStat::where('user_id', $user->id)->delete();
        $stat = UserStat::forUser($user->id);

        $flags = [];
        MatchResult::where('user_id', $user->id)->orderBy('created_at')->orderBy('id')
            ->chunkById(500, function ($rows) use ($user, $updater, &$flags) {
                foreach ($rows as $mr) {
                    $ctx = $updater->updateForMatch($user, $mr, [], true); // replay=true
                    foreach ($ctx->activeFlags() as $f) {
                        $flags[$f] = true;
                    }
                    $user->unsetRelation('stat');
                }
            });

        // Nihai duzeltmeler: kariyer zirvesi + lifetime coin (coins_after pozitif farklari).
        $stat = UserStat::forUser($user->id);
        $peak = (int) (MatchResult::where('user_id', $user->id)->max('rating_after') ?? 0);
        $stat->best_rating = max((int) $stat->best_rating, $peak, (int) ($user->rating ?? 1500));
        $stat->lifetime_coin = $this->lifetimeCoin($user->id);
        $stat->tournaments_won = Tournament::where('champion_id', $user->id)->where('status', 'finished')->count();
        $stat->save();

        // Tek-seferlik nihai bayraklar (liderlik sirasi + nemesis/komsu).
        $master = new MatchContext();
        foreach (array_keys($flags) as $f) {
            $master->set($f);
        }
        $updater->finalizeFlags($user, $master);

        if ($dry) {
            // Yazmadan say: sahip olmadigi + hak ettigi rozet sayisi (yaklasik).
            return $this->countWouldUnlock($user, $svc, $master);
        }

        $user->unsetRelation('stat');
        $new = $svc->evaluate($user, $master, true, false); // silent + no coin
        return count($new);
    }

    /** DRY-RUN sayaci: gercek unlock yapmadan kac rozet acilacagini kestir. */
    private function countWouldUnlock(User $user, AchievementService $svc, MatchContext $ctx): int
    {
        $owned = \App\Models\UserAchievement::where('user_id', $user->id)->pluck('achievement_slug')->flip();
        $stat = UserStat::forUser($user->id);
        $n = 0;
        foreach (\App\Services\Achievements\AchievementCatalog::all() as $def) {
            if (isset($owned[$def['slug']])) {
                continue;
            }
            if (($def['type'] ?? 'threshold') === 'event') {
                if ($ctx->has($def['metric'])) {
                    $n++;
                }
            } else {
                if (\App\Services\Achievements\MetricResolver::value($user, $stat, $def['metric']) >= $def['value']) {
                    $n++;
                }
            }
        }
        return $n;
    }

    /** Lifetime coin yaklasigi: match_results.coins_after zaman-sirali pozitif farklar toplami. */
    private function lifetimeCoin(int $userId): int
    {
        $sum = 0;
        $prev = null;
        MatchResult::where('user_id', $userId)->whereNotNull('coins_after')
            ->orderBy('created_at')->orderBy('id')->select('coins_after')
            ->chunk(1000, function ($rows) use (&$sum, &$prev) {
                foreach ($rows as $r) {
                    $c = (int) $r->coins_after;
                    if ($prev !== null && $c > $prev) {
                        $sum += ($c - $prev);
                    }
                    $prev = $c;
                }
            });
        return $sum;
    }
}
