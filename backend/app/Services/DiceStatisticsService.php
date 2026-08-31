<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Zar Ortalamalari (dice averages) — decision_analyses'ten zar-basina kirilim.
 *
 * Kaynak: decision_analyses (Hata Gunlugu ile ayni tablo). Her checker karari icin
 * dice + equity_loss + my_pip + (mac uzerinden) won bilgisi vardir. Karar satiri
 * SEN (is_opponent=false) veya RAKIP (is_opponent=true) olabilir.
 *
 * Faz (image 33 sekmeleri): primary_category ile eslesir.
 *   opening -> 'opening'          (Acilis)
 *   race    -> 'race'             (Temas Yok)
 *   contact -> digerleri          (Temas)
 *   all     -> hepsi
 *
 * MOTOR CALISTIRMAZ; sadece SQL toplar. Profil sik acildigi icin 6 saat cache.
 */
class DiceStatisticsService
{
    /** Desteklenen faz filtreleri. */
    public const PHASES = ['all', 'opening', 'contact', 'race'];

    /** @return array{phase:string, self:array, opponent:array} */
    public function diceStats(User $user, string $phase): array
    {
        if (! in_array($phase, self::PHASES, true)) {
            $phase = 'all';
        }

        return Cache::remember(
            "player:{$user->id}:dice-stats:{$phase}",
            now()->addHours(6),
            fn () => $this->compute($user->id, $phase),
        );
    }

    /** Yeni mac/analiz sonrasi kullanicinin tum faz cache'lerini temizle. */
    public function invalidate(int $userId): void
    {
        foreach (self::PHASES as $phase) {
            Cache::forget("player:{$userId}:dice-stats:{$phase}");
        }
    }

    /** @return array{phase:string, self:array, opponent:array} */
    private function compute(int $userId, string $phase): array
    {
        $rows = $this->aggregate($userId, $phase);
        $opening = $this->openingWinRates($userId);

        return [
            'phase' => $phase,
            'self' => $this->side($rows, false, $opening['self']),
            'opponent' => $this->side($rows, true, $opening['opponent']),
        ];
    }

    /**
     * dice + is_opponent bazinda toplam. win_self = macin KULLANICI tarafindan
     * kazanilma orani (0..1); rakip tarafi icin 1'den cikarilir.
     * @return \Illuminate\Support\Collection<int,object>
     */
    private function aggregate(int $userId, string $phase)
    {
        return DB::table('decision_analyses as da')
            ->join('match_results as mr', 'mr.id', '=', 'da.match_result_id')
            ->where('da.user_id', $userId)
            ->where('da.decision_type', 'checker')
            ->whereNotNull('da.dice')
            ->when($phase !== 'all', fn ($q) => $this->applyPhase($q, $phase))
            ->groupBy('da.dice', 'da.is_opponent')
            ->selectRaw(
                'da.dice as dice, da.is_opponent as is_opponent, count(*) as n, '
                .'avg(da.equity_loss) as avg_loss, avg(da.my_pip) as avg_pip, '
                .'avg(case when mr.won = 1 then 1.0 else 0.0 end) as win_self'
            )
            ->get();
    }

    private function applyPhase($q, string $phase)
    {
        return match ($phase) {
            'opening' => $q->where('da.primary_category', 'opening'),
            'race' => $q->where('da.primary_category', 'race'),
            'contact' => $q->whereNotIn('da.primary_category', ['opening', 'race']),
            default => $q,
        };
    }

    /**
     * Tek taraf (Sen/Rakip) icin zar listesi + ozet.
     * Zarlar kanonik (buyuk-kucuk) anahtarla birlestirilir: "3-6" == "6-3".
     * @return array{sample:int, openingWinRate:?float, rolls:array}
     */
    private function side($rows, bool $opponent, ?float $openingWin): array
    {
        $byDice = [];
        foreach ($rows as $r) {
            if ((bool) $r->is_opponent !== $opponent) {
                continue;
            }
            $key = $this->canonical($r->dice);
            if (! isset($byDice[$key])) {
                $byDice[$key] = ['n' => 0, 'loss' => 0.0, 'pip' => 0.0, 'win' => 0.0];
            }
            $n = (int) $r->n;
            $byDice[$key]['n'] += $n;
            $byDice[$key]['loss'] += (float) $r->avg_loss * $n;   // agirlikli toplam
            $byDice[$key]['pip'] += (float) $r->avg_pip * $n;
            $byDice[$key]['win'] += (float) $r->win_self * $n;
        }

        $rolls = [];
        $sample = 0;
        foreach ($byDice as $dice => $a) {
            $n = $a['n'];
            $sample += $n;
            // win_self kullanicinin kazanma orani; rakip icin ters cevir.
            $win = $n > 0 ? $a['win'] / $n : 0.0;
            $winRate = $opponent ? (1.0 - $win) : $win;
            $rolls[] = [
                'dice' => $dice,
                'n' => $n,
                'avgError' => $n > 0 ? round($a['loss'] / $n, 4) : 0.0,
                'avgPip' => $n > 0 ? (int) round($a['pip'] / $n) : null,
                'winRate' => round($winRate * 100, 1),
            ];
        }

        // Cok oynanan zar ustte.
        usort($rolls, fn ($x, $y) => $y['n'] <=> $x['n']);

        return [
            'sample' => $sample,
            'openingWinRate' => $openingWin,
            'rolls' => $rolls,
        ];
    }

    /**
     * Acilis kazanma orani (image 33 "Acilis Kazanma %") — faz filtresinden bagimsiz.
     * @return array{self:?float, opponent:?float}
     */
    private function openingWinRates(int $userId): array
    {
        $rows = DB::table('decision_analyses as da')
            ->join('match_results as mr', 'mr.id', '=', 'da.match_result_id')
            ->where('da.user_id', $userId)
            ->where('da.decision_type', 'checker')
            ->where('da.primary_category', 'opening')
            ->groupBy('da.is_opponent')
            ->selectRaw('da.is_opponent as is_opponent, count(*) as n, '
                .'avg(case when mr.won = 1 then 1.0 else 0.0 end) as win_self')
            ->get();

        $self = null;
        $opp = null;
        foreach ($rows as $r) {
            if ((int) $r->n === 0) {
                continue;
            }
            if ((bool) $r->is_opponent) {
                $opp = round((1.0 - (float) $r->win_self) * 100, 1);
            } else {
                $self = round((float) $r->win_self * 100, 1);
            }
        }

        return ['self' => $self, 'opponent' => $opp];
    }

    /** "3-6" -> "6-3" (buyuk-kucuk kanonik). */
    private function canonical(?string $dice): string
    {
        if (! $dice || ! str_contains($dice, '-')) {
            return (string) $dice;
        }
        [$a, $b] = array_pad(explode('-', $dice, 2), 2, '0');
        $a = (int) $a;
        $b = (int) $b;

        return $a >= $b ? "{$a}-{$b}" : "{$b}-{$a}";
    }
}
