<?php

namespace App\Support\TeamLeague;

use App\Models\Team;
use App\Models\TeamSeasonChampion;
use App\Models\User;
use App\Services\WalletService;
use App\Support\DuelService;
use Illuminate\Support\Carbon;

/**
 * Sıralama matematiği (saf — DB okur, yan etkisiz; ödül dağıtımı hariç). Kayan nokta eşitliği
 * epsilon ile karşılaştırılır (§6: gösterim yuvarlaması sıralamayı etkilemez).
 */
class TeamStandings
{
    private const EPS = 1e-9;

    /**
     * Ana takım sıralaması (§6): rating_avg (önbellek) üzerinden; ≥8 üye şartı. Eşitlik:
     * 1) ortalama, 2) üye sayısı, 3) ortak sıra. Liste için ağır per-takım sorgu YOK.
     *
     * @return list<array{team: Team, avg: float, members: int, rank: int}>
     */
    public function mainTable(): array
    {
        $rows = Team::where('status', 'active')
            ->where('member_count', '>=', TeamRules::MIN_RANK_MEMBERS)
            ->get()
            ->map(fn (Team $t) => [
                'team' => $t,
                'avg' => (float) $t->rating_avg,
                'members' => (int) $t->member_count,
            ])->values()->all();

        usort($rows, function ($a, $b) {
            if (abs($a['avg'] - $b['avg']) > self::EPS) {
                return $b['avg'] <=> $a['avg'];
            }

            return $b['members'] <=> $a['members'];
        });

        return $this->assignRanks(
            $rows,
            fn ($a, $b) => abs($a['avg'] - $b['avg']) <= self::EPS && $a['members'] === $b['members']
        );
    }

    /**
     * SEZON SONU ödül/kayıt (§10). Sıralama = DÜELLO PUANI (o sezon penceresinde kazanılan düello
     * puanı toplamı; TeamMatch/5v5 YOK). İlk 3 takım team_season_champions'a KALICI yazılır. Ödüller:
     *   • Şampiyon (1.): +30.000 coin TAKIM BAKİYESİNE + SONRAKİ SEZON boyunca rozet.
     *   • "En İyi Düellocu" (bireysel 1.): +5.000 coin KİŞİSEL cüzdanına (WalletService idempotent key).
     * Idempotent: unique(season_key, team_id) firstOrCreate → coin yalnız kayıt İLK oluşunca verilir;
     * bireysel ödül wallet idempotency_key='duel_best:<sezon>' ile tekrarlanmaz. Düello puanı penceresi
     * kaydığı için yeni sezon 0'dan başlar (ekstra sıfırlama yok).
     *
     * @return int yeni oluşturulan takım kaydı sayısı
     */
    public function distributeSeasonAwards(string $seasonKey, ?Carbon $now = null): int
    {
        $now = $now ? $now->copy() : now();
        $from = TeamSeason::start($seasonKey);
        $to = TeamSeason::endExclusive($seasonKey);
        $created = 0;

        // İlk 3 takım (düello puanı > 0 olanlar; 0 puanlı takım derece almaz). teamLeaderboard zaten
        // düello puanı (wins) DESC sıralı; eşit puan = ortak derece (rekabet rankı).
        $ranked = array_values(array_filter(
            DuelService::teamLeaderboard(100, $from, $to),
            fn ($r) => (int) $r['wins'] > 0
        ));
        $rank = 0;
        $prevPts = null;
        foreach ($ranked as $i => $r) {
            $pts = (int) $r['wins'];
            if ($prevPts === null || $pts !== $prevPts) {
                $rank = $i + 1;
            }
            $prevPts = $pts;
            if ($rank > 3) {
                break;
            }
            $team = Team::find($r['team_id']);
            if (! $team) {
                continue;
            }
            $champ = TeamSeasonChampion::firstOrCreate(
                ['season_key' => $seasonKey, 'team_id' => (int) $r['team_id']],
                [
                    'rank' => $rank,
                    'points' => $pts,
                    'diff' => 0,
                    'wins' => $pts,
                    'played' => 0,
                    'team_name' => $team->name,
                    'created_at' => $now,
                ]
            );
            if (! $champ->wasRecentlyCreated) {
                continue; // zaten dağıtılmış (idempotent) → coin tekrar verme
            }
            $created++;
            if ($rank === 1) {
                // Şampiyon: +30.000 coin takım bakiyesine + sonraki sezon rozeti (tek save).
                $team->coin_balance = (int) ($team->coin_balance ?? 0) + TeamRules::CHAMPION_COIN;
                $team->champion_badge_until = TeamSeason::end($seasonKey)->addMonthsNoOverflow(3);
                $team->save();
            }
        }

        // En İyi Düellocu (bireysel 1.): +5.000 coin oyuncu cüzdanına. Idempotent key = sezon.
        $best = DuelService::individualLeaderboard(1, $from, $to);
        if (! empty($best) && (int) $best[0]['wins'] > 0) {
            $user = User::find((int) $best[0]['user_id']);
            if ($user) {
                app(WalletService::class)->credit(
                    $user, TeamRules::BEST_DUELIST_COIN, 'duel_best_season', 'duel_season', null,
                    'duel_best:'.$seasonKey
                );
            }
        }

        return $created;
    }

    /**
     * Rekabet sıralaması (1,1,3): $tie($prev,$row) true ise aynı rank (ortak derece).
     *
     * @param  list<array<string,mixed>>  $rows
     * @return list<array<string,mixed>>
     */
    private function assignRanks(array $rows, callable $tie): array
    {
        $out = [];
        $rank = 0;
        $i = 0;
        $prev = null;
        foreach ($rows as $r) {
            $i++;
            if ($prev === null || ! $tie($prev, $r)) {
                $rank = $i;
            }
            $r['rank'] = $rank;
            $out[] = $r;
            $prev = $r;
        }

        return $out;
    }
}
