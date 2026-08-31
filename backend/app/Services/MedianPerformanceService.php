<?php

namespace App\Services;

use App\Models\MatchResult;
use App\Support\StatsConfig;
use Illuminate\Support\Facades\DB;

/**
 * Medyan Hata Orani: oyuncunun her kategorideki (Jeton/1S/3S/5S/7S) MATCH PR
 * degerlerinin GERCEK MEDIAN'i (ortalama DEGIL). Kategoriler tamamen bagimsiz.
 *
 * Kaynak: match_results.pr (mac-basina, OYUNCU-basina PR; rakibin pr'i karismaz).
 * Yalniz tamamlanmis maclar (match_results satiri = tamamlanmis mac) + pr IS NOT NULL.
 *
 * Performans: Match::all() YOK. Yalnizca gerekli kolonlar (match_type, match_length, pr)
 * ve tarih araligi cekilir; kullanici basina birkac yuz satir. Median PHP'de hesaplanir
 * (DB'ye ozel percentile fonksiyonlarina bagimlilik yok -> guvenilir + tasinabilir).
 */
class MedianPerformanceService
{
    /**
     * @param  string  $filter  'all'|'7d'|'30d'|'90d'|'1y'
     * @return array<string, array{label:string, median_pr:float|null, sample_count:int}>
     */
    public function categoriesFor(int $userId, string $filter): array
    {
        $days = StatsConfig::DATE_FILTERS[$filter] ?? null;

        $q = MatchResult::query()
            ->where('user_id', $userId)
            ->whereNotNull('pr');

        if ($days !== null) {
            // Bitis zamani = match_results.created_at (satir mac bitince olusur).
            $q->where('created_at', '>=', now()->subDays($days));
        }

        // Sadece gerekli kolonlar -> hafif. (index: [user_id, created_at])
        $rows = $q->get(['match_type', 'match_length', 'pr']);

        // Kategori bucket'la (PR degerleri).
        $buckets = [];
        foreach ($rows as $r) {
            $len = $r->match_length !== null ? (int) $r->match_length : null;
            $key = StatsConfig::categoryKey($r->match_type ?? StatsConfig::MATCH_TYPE_MATCH, $len);
            if ($key === null) {
                continue;
            }
            $buckets[$key][] = (float) $r->pr;
        }

        $out = [];
        foreach (StatsConfig::CATEGORIES as $key => $label) {
            $vals = $buckets[$key] ?? [];
            $out[$key] = [
                'label' => $label,
                'median_pr' => self::median($vals), // veri yoksa null (0.00 DEGIL)
                'sample_count' => count($vals),
            ];
        }

        return $out;
    }

    /**
     * PER-KARAR Medyan Hata Orani (gercek median error). Kaynak: decision_analyses.
     * Her checker kararinin equity_loss'u (= max(0, best-played)) alinir; kategori
     * bazinda (Jeton/1S/3S/5S/7S) GERCEK MEDYANI hesaplanir. Ortalama DEGIL -> birkac
     * blunder degeri sismaz.
     *
     * Olcek: equity_loss * 500 (mac-basi PR = mean(loss)*500 ile AYNI birim) -> kart
     * ayni "PR" skalasinda ve "dusuk=iyi" esigi gecerli kalir; fark: mean yerine
     * per-karar MEDIAN.
     *
     * Kapsam: yalniz analiz edilmis maclar (decision_analyses dolu = bilgisayara karsi
     * oyunlar). Rakip kararlari (is_opponent) ve forced hamleler haric (forced zaten
     * yakalama aninda kaydedilmez); cube farkli olcek oldugundan zaten tabloda yok.
     *
     * @param  string  $filter  'all'|'7d'|'30d'|'90d'|'1y'
     * @return array<string, array{label:string, median_pr:float|null, sample_count:int}>
     */
    public function perDecisionCategoriesFor(int $userId, string $filter): array
    {
        $days = StatsConfig::DATE_FILTERS[$filter] ?? null;

        $q = DB::table('decision_analyses as da')
            ->join('match_results as mr', 'mr.id', '=', 'da.match_result_id')
            ->where('da.user_id', $userId)
            ->where('da.decision_type', 'checker')
            ->where('da.is_opponent', false); // yalniz oyuncunun kendi kararlari

        if ($days !== null) {
            $q->where('da.played_at', '>=', now()->subDays($days));
        }

        $rows = $q->get(['da.equity_loss', 'mr.match_type', 'mr.match_length']);

        // Kategori bucket'la (per-karar hata degerleri, PR olcegi).
        $buckets = [];
        foreach ($rows as $r) {
            $len = $r->match_length !== null ? (int) $r->match_length : null;
            $key = StatsConfig::categoryKey($r->match_type ?? StatsConfig::MATCH_TYPE_MATCH, $len);
            if ($key === null) {
                continue;
            }
            $buckets[$key][] = (float) $r->equity_loss * 500;
        }

        $out = [];
        foreach (StatsConfig::CATEGORIES as $key => $label) {
            $vals = $buckets[$key] ?? [];
            $out[$key] = [
                'label' => $label,
                'median_pr' => self::median($vals), // veri yoksa null
                'sample_count' => count($vals),     // KARAR sayisi (mac degil)
            ];
        }

        return $out;
    }

    /**
     * Gercek median. Tek sayida -> ortadaki; cift sayida -> ortadaki iki degerin ortalamasi.
     * Bos -> null. Hesap tam precision; sonuc UI icin 2 ondalik yuvarlanir.
     *
     * @param  array<int, float>  $values
     */
    public static function median(array $values): ?float
    {
        $n = count($values);
        if ($n === 0) {
            return null;
        }
        sort($values, SORT_NUMERIC);
        $mid = intdiv($n, 2);
        $m = ($n % 2 === 1)
            ? $values[$mid]
            : ($values[$mid - 1] + $values[$mid]) / 2;

        return round($m, 2);
    }
}
