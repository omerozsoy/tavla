<?php

namespace App\Support\TeamLeague;

use App\Models\Team;
use App\Models\TeamAward;
use App\Models\TeamMatch;
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
     * Aylık meydan okuma sıralaması (§10). Puan: galibiyet 3 / beraberlik 1 / mağlubiyet 0.
     * Çift-hükmen → iki tarafa 0, skor farkı yok (beraberlik DEĞİL). Eşitlik: 1) puan,
     * 2) eşleşme puanı farkı (takım skoru farkı toplamı), 3) takım galibiyeti, 4) ortak derece.
     *
     * @return list<array{team_id: int, pts: int, diff: int, wins: int, played: int, rank: int}>
     */
    public function monthlyTable(string $monthKey): array
    {
        $matches = TeamMatch::where('month_key', $monthKey)
            ->where('status', 'finished')
            ->whereNotNull('result')
            ->get();

        $agg = [];
        $touch = function (int $teamId) use (&$agg) {
            if (! isset($agg[$teamId])) {
                $agg[$teamId] = ['team_id' => $teamId, 'pts' => 0, 'diff' => 0, 'wins' => 0, 'played' => 0];
            }
        };

        foreach ($matches as $m) {
            $home = (int) $m->home_team_id;
            $away = (int) $m->away_team_id;
            $touch($home);
            $touch($away);
            $agg[$home]['played']++;
            $agg[$away]['played']++;

            if ($m->result === 'double_forfeit') {
                continue; // iki tarafa da 0 puan; skor farkı/galibiyet yok
            }

            $hs = (float) $m->home_score;
            $as = (float) $m->away_score;
            $agg[$home]['diff'] += ($hs - $as); // yarım puan dahil (2.5-2.5 → 0)
            $agg[$away]['diff'] += ($as - $hs);

            if ($m->result === 'home_win') {
                $agg[$home]['pts'] += TeamRules::PTS_WIN;
                $agg[$home]['wins']++;
            } elseif ($m->result === 'away_win') {
                $agg[$away]['pts'] += TeamRules::PTS_WIN;
                $agg[$away]['wins']++;
            } elseif ($m->result === 'draw') {
                $agg[$home]['pts'] += TeamRules::PTS_DRAW;
                $agg[$away]['pts'] += TeamRules::PTS_DRAW;
            }
        }

        $rows = array_values($agg);
        usort($rows, function ($a, $b) {
            if ($a['pts'] !== $b['pts']) {
                return $b['pts'] <=> $a['pts'];
            }
            if (abs($a['diff'] - $b['diff']) > self::EPS) {
                return $b['diff'] <=> $a['diff'];
            }

            return $b['wins'] <=> $a['wins'];
        });

        return $this->assignRanks(
            $rows,
            fn ($a, $b) => $a['pts'] === $b['pts'] && abs($a['diff'] - $b['diff']) <= self::EPS && $a['wins'] === $b['wins']
        );
    }

    /**
     * Aylık ödül dağıtımı (§10): ilk üçe kupa, şampiyona bir ay rozet. Ortak dereceler hepsi alır.
     * Idempotent: unique(team_id, month_key, kind) + firstOrCreate → tekrar çalışınca mükerrer üretmez.
     *
     * @return int yeni oluşturulan ödül satırı sayısı
     */
    public function distributeMonthlyAwards(string $monthKey, ?Carbon $now = null): int
    {
        $now = $now ? $now->copy() : now();
        $created = 0;
        foreach ($this->monthlyTable($monthKey) as $r) {
            if ($r['rank'] > 3) {
                continue;
            }
            $cup = TeamAward::firstOrCreate(
                ['team_id' => $r['team_id'], 'month_key' => $monthKey, 'kind' => 'cup'],
                ['rank' => $r['rank'], 'created_at' => $now]
            );
            if ($cup->wasRecentlyCreated) {
                $created++;
            }
            if ($r['rank'] === 1) {
                $badge = TeamAward::firstOrCreate(
                    ['team_id' => $r['team_id'], 'month_key' => $monthKey, 'kind' => 'champion_badge'],
                    ['rank' => 1, 'created_at' => $now]
                );
                if ($badge->wasRecentlyCreated) {
                    $created++;
                }
                // Şampiyon rozeti SONRAKİ takvim ayı boyunca (ay+2'nin başına kadar).
                $team = Team::find($r['team_id']);
                if ($team) {
                    $team->champion_badge_until = Carbon::createFromFormat('Y-m', $monthKey)
                        ->startOfMonth()->addMonthsNoOverflow(2)->startOfMonth();
                    $team->save();
                }
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
