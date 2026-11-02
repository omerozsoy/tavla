<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Geçmişte takma adını değiştirmiş üyeleri TESPİT edip nickname_history'ye TOPLU doldurur.
 * Forward-fill (User updating event) yalnız 2026-11-02'den sonraki değişiklikleri yakalar; ÖNCEKİLER
 * için tek tarihsel kaynak match_results.opponent_name (maç anındaki rakip nick snapshot'ı) +
 * opponent_user_id. Bir üyenin kimliğiyle oynanmış maçta kayıtlı rakip adı, o üyenin ŞİMDİKİ
 * nick'inden farklıysa -> eski nick'tir. 'at' = o eski adın SON görüldüğü maç tarihi (değişim anı
 * tahmini), kayıt backfill=true ile işaretlenir. Idempotent: zaten listede olan nick atlanır.
 *
 *   php artisan tavla:backfill-nickname-history [--dry-run]
 */
class BackfillNicknameHistory extends Command
{
    protected $signature = 'tavla:backfill-nickname-history {--dry-run}';

    protected $description = 'Geçmiş isim değiştirenleri match_results snapshot\'ından nickname_history\'ye toplu taşır';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        // (üye, eski-ad) -> o adın son görüldüğü tarih. GROUP BY = her çift tek satır.
        $pairs = DB::table('match_results')
            ->where('opponent_user_id', '>', 0)
            ->whereNotNull('opponent_name')
            ->where('opponent_name', '!=', '')
            ->groupBy('opponent_user_id', 'opponent_name')
            ->get([
                'opponent_user_id as uid',
                'opponent_name as nick',
                DB::raw('MAX(created_at) as last_at'),
            ]);

        // uid -> [nick => last_at] (PHP'de case-insensitive süzme için topla)
        $byUser = [];
        foreach ($pairs as $p) {
            $byUser[(int) $p->uid][] = $p;
        }

        // Şimdiki tüm nick'ler: lower(nick) -> user_id. Bir eski-ad snapshot'ı BAŞKA bir üyenin
        // ŞİMDİKİ nick'iyse, opponent_user_id yanlış eşleşmiştir (ör. aynı ad iki üyeye atanır) ->
        // o ada gerçekten sahip olana ait say, yanlış üyeye YAZMA.
        $currentOwner = [];
        foreach (User::query()->whereNotNull('nickname')->where('nickname', '!=', '')->get(['id', 'nickname']) as $u) {
            $currentOwner[mb_strtolower(trim((string) $u->nickname))] = $u->id;
        }

        $users = User::whereIn('id', array_keys($byUser))->get(['id', 'nickname', 'nickname_history']);
        $usersTouched = 0;
        $nicksAdded = 0;

        foreach ($users as $user) {
            $current = mb_strtolower(trim((string) $user->nickname));
            $history = $user->nickname_history ?? [];
            // Listede/şimdiki olan adları set'le (idempotent + tekrar engelle).
            $have = [];
            foreach ($history as $h) {
                $have[mb_strtolower(trim((string) ($h['nickname'] ?? '')))] = true;
            }

            $added = [];
            foreach ($byUser[$user->id] as $p) {
                $nick = trim((string) $p->nick);
                $key = mb_strtolower($nick);
                if ($key === '' || $key === $current || isset($have[$key])) {
                    continue; // şimdiki ad veya zaten kayıtlı -> atla
                }
                if (isset($currentOwner[$key]) && $currentOwner[$key] !== $user->id) {
                    continue; // bu ad BAŞKA aktif üyenin şimdiki nick'i -> yanlış eşleşme, atla
                }
                $have[$key] = true;
                $added[] = ['nickname' => $nick, 'at' => (string) $p->last_at, 'backfill' => true];
            }
            if (! $added) {
                continue;
            }

            // Mevcut + yeni -> tarihe göre sırala (kronolojik, forward-fill ile aynı düzen).
            $merged = array_merge($history, $added);
            usort($merged, fn ($a, $b) => strcmp((string) ($a['at'] ?? ''), (string) ($b['at'] ?? '')));

            $usersTouched++;
            $nicksAdded += count($added);
            if (! $dry) {
                // updating event'i TEKRAR tetiklemesin diye nickname'e dokunmadan doğrudan yaz.
                User::where('id', $user->id)->update(['nickname_history' => json_encode($merged, JSON_UNESCAPED_UNICODE)]);
            }
            $this->line('  #'.$user->id.' '.$user->nickname.' <- '.implode(', ', array_column($added, 'nickname')));
        }

        $this->info(($dry ? '[DRY] ' : '')."İsim değiştiren üye: $usersTouched, eklenen eski ad: $nicksAdded");

        return self::SUCCESS;
    }
}
