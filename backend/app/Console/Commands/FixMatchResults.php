<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use App\Support\RoomResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Eski online mac kayitlarinda YANLIS galibiyet/maglubiyet + rating'i geriye donuk
 * duzeltir. Dogru sonuc odanin paylasilan durumundan (RoomResult) belirlenir.
 *
 * Varsayilan DRY-RUN (yalniz rapor). Yazmak icin: --apply
 *
 * Sinir: rating cascade YENIDEN hesaplanmaz; her yanlis satirin delta'si dogru
 * Elo ile duzeltilip kullanicinin GUNCEL rating'i net farkla toplanir (won/kayip
 * sayisi da). Odasi silinmis satirlar dogrulanamaz -> atlanir. Idempotent.
 */
class FixMatchResults extends Command
{
    protected $signature = 'matches:fix-results {--apply : Degisiklikleri yaz (varsayilan dry-run)}';

    protected $description = 'Eski online mac kayitlarinda yanlis galibiyet/rating\'i odadan otoriter duzeltir';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $k = 32;

        $checked = 0;
        $wrong = 0;
        $unverifiable = 0;
        // userId => ['rating'=>int, 'wins'=>int, 'losses'=>int]
        $userAdj = [];

        $rows = MatchResult::whereNotNull('room_code')->orderBy('id')->get();
        $this->info('İncelenen (room_code\'lu) kayıt: '.$rows->count());

        $updates = []; // uygulama icin biriktir

        foreach ($rows as $row) {
            $room = Room::where('code', $row->room_code)->first();
            if (! $room) {
                $unverifiable++;

                continue;
            }
            $res = RoomResult::resolve($room, (int) $row->user_id);
            if ($res === null) {
                $unverifiable++;

                continue;
            }
            $checked++;
            $correct = $res['won'];
            if ((bool) $row->won === $correct) {
                continue; // zaten dogru
            }

            $wrong++;
            $uid = (int) $row->user_id;
            $userAdj[$uid] ??= ['rating' => 0, 'wins' => 0, 'losses' => 0];

            // Ranked mi? (casual/friendly satirlarda rating degismez: delta 0 + rating_before==rating_after)
            $rb = $row->rating_before;
            $ranked = $rb !== null && ((int) $row->delta !== 0 || (int) $row->rating_after !== (int) $rb);

            $newDelta = (int) $row->delta;
            $newAfter = (int) $row->rating_after;
            if ($ranked) {
                $rbI = (int) $rb;
                $rOpp = (int) $row->opponent_rating;
                $expected = 1 / (1 + pow(10, ($rOpp - $rbI) / 400));
                $newScore = $correct ? 1 : 0;
                $newAfter = max(100, (int) round($rbI + $k * ($newScore - $expected)));
                $newDelta = $newAfter - $rbI;
                $userAdj[$uid]['rating'] += $newDelta - (int) $row->delta;
                if ($correct) {
                    $userAdj[$uid]['wins']++;
                    $userAdj[$uid]['losses']--;
                } else {
                    $userAdj[$uid]['wins']--;
                    $userAdj[$uid]['losses']++;
                }
            }

            $this->line(sprintf(
                '  #%d user=%d room=%s: won %s -> %s%s',
                $row->id, $uid, $row->room_code,
                $row->won ? 'W' : 'L', $correct ? 'W' : 'L',
                $ranked ? sprintf(' | delta %+d -> %+d, rating_after %d -> %d', (int) $row->delta, $newDelta, (int) $row->rating_after, $newAfter) : ' (casual)'
            ));

            $updates[] = [
                'row' => $row,
                'won' => $correct,
                'delta' => $newDelta,
                'rating_after' => $newAfter,
                'self' => $res['self'],
                'opp' => $res['opp'],
            ];
        }

        $this->newLine();
        $this->info("Dogrulanan: $checked | Yanlis (duzeltilecek): $wrong | Dogrulanamaz (oda yok/kararsiz): $unverifiable");
        if (! empty($userAdj)) {
            $this->info('Kullanici rating/istatistik net degisimi:');
            foreach ($userAdj as $uid => $a) {
                $u = User::find($uid);
                $this->line(sprintf('  %s (id=%d): rating %+d, wins %+d, losses %+d',
                    $u?->nickname ?? '?', $uid, $a['rating'], $a['wins'], $a['losses']));
            }
        }

        if (! $apply) {
            $this->warn('DRY-RUN — hicbir sey yazilmadi. Uygulamak icin: php artisan matches:fix-results --apply');

            return self::SUCCESS;
        }

        if ($wrong === 0) {
            $this->info('Duzeltilecek kayit yok.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($updates, $userAdj) {
            foreach ($updates as $u) {
                /** @var MatchResult $row */
                $row = $u['row'];
                $row->won = $u['won'];
                $row->delta = $u['delta'];
                $row->rating_after = $u['rating_after'];
                if ($u['self'] !== null) {
                    $row->score_self = $u['self'];
                }
                if ($u['opp'] !== null) {
                    $row->score_opp = $u['opp'];
                }
                $row->save();
            }
            foreach ($userAdj as $uid => $a) {
                $user = User::find($uid);
                if (! $user) {
                    continue;
                }
                $user->rating = max(100, (int) ($user->rating ?? 1500) + $a['rating']);
                $user->wins = max(0, (int) ($user->wins ?? 0) + $a['wins']);
                $user->losses = max(0, (int) ($user->losses ?? 0) + $a['losses']);
                $user->save();
            }
        });

        $this->info("UYGULANDI: $wrong kayit duzeltildi, ".count($userAdj).' kullanici guncellendi.');

        return self::SUCCESS;
    }
}
