<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;

/**
 * YENİ rütbe sistemi (rating + PR + EP) ENFORCEMENT'ı — oyuncunun gösterilen rütbe
 * anahtarını (div.*) belirler ve users.rank_key önbelleğine yazar (ayrıca rank_window_pr +
 * rank_ep önbelleği -> admin önizlemesi hızlı).
 *
 * TOGGLE: `rank_system_active`. KAPALI -> rank_key null (frontend rating'e düşer = sıfır değişiklik).
 * AÇIK -> üç kriter (rating ≥ min, PR ≤ prMax, EP ≥ epMin) sağlanan EN YÜKSEK kademe.
 * PROVISIONAL: PR verisi yoksa (null) CEZALANDIRILMAZ -> rating rütbesi.
 */
class RankService
{
    public static function active(): bool
    {
        return Setting::get('rank_system_active', '0') === '1';
    }

    /** Rating'in ulaştığı en yüksek kademe (frontend rankOf ile AYNI). */
    public static function ratingDivKey(int $rating): string
    {
        $key = 'div.rookie';
        foreach (RankDivisions::thresholds() as $k => $min) {
            if ($rating >= $min) {
                $key = $k;
            }
        }

        return $key;
    }

    /**
     * SAF hesap: verilen eşiklerle efektif rütbe anahtarı. (effectiveDivKey + önizleme ortak kullanır.)
     * PR null -> provisional: rating rütbesi (ceza yok).
     *
     * @param  array<string,int>  $ratingMin  kademe=>rating alt eşiği (düşükten yükseğe)
     * @param  array<string,float>  $prMax  kademe=>PR üst eşiği (rookie YOK = sonsuz)
     * @param  array<string,int>  $epMin  kademe=>min EP
     */
    public static function effectiveKeyFrom(int $rating, ?float $pr, int $ep, array $ratingMin, array $prMax, array $epMin): string
    {
        if ($pr === null) {
            $key = 'div.rookie';
            foreach ($ratingMin as $k => $min) {
                if ($rating >= $min) {
                    $key = $k;
                }
            }

            return $key;
        }
        $key = 'div.rookie';
        foreach ($ratingMin as $k => $min) {
            if ($rating < $min) {
                continue;
            }
            if ($pr > ($prMax[$k] ?? INF)) {
                continue;
            }
            if ($ep < (int) ($epMin[$k] ?? 0)) {
                continue;
            }
            $key = $k;
        }

        return $key;
    }

    /** Yürürlükteki eşiklerle efektif rütbe; sistem kapalıysa null. */
    public static function effectiveDivKey(User $u): ?string
    {
        if (! self::active()) {
            return null;
        }
        $prog = RankProgress::forUser($u);

        return self::effectiveKeyFrom(
            (int) ($u->rating ?? 1500),
            $prog['window_pr'],
            (int) $prog['ep'],
            RankDivisions::thresholds(),
            RankDivisions::prThresholds(),
            RankDivisions::epThresholds(),
        );
    }

    /** rank_key + PR/EP önbelleğini yeniden hesapla + kaydet. */
    public static function refresh(User $u): void
    {
        $prog = RankProgress::forUser($u);
        $pr = $prog['window_pr'];
        $ep = (int) $prog['ep'];
        $key = self::active()
            ? self::effectiveKeyFrom((int) ($u->rating ?? 1500), $pr, $ep, RankDivisions::thresholds(), RankDivisions::prThresholds(), RankDivisions::epThresholds())
            : null;
        if ($u->rank_key !== $key || (float) $u->rank_window_pr !== (float) $pr || (int) $u->rank_ep !== $ep) {
            $u->forceFill(['rank_key' => $key, 'rank_window_pr' => $pr, 'rank_ep' => $ep])->save();
        }
    }

    /** TÜM oyuncular için yeniden hesapla. Sayı döner. */
    public static function refreshAll(int $chunk = 200): int
    {
        $count = 0;
        User::query()->select(['id', 'rating', 'rank_key', 'rank_window_pr', 'rank_ep'])
            ->chunkById($chunk, function ($users) use (&$count) {
                foreach ($users as $u) {
                    self::refresh($u);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * ÖNİZLEME: verilen eşiklerle (henüz KAYDETMEDEN) oyuncu dağılımını + mevcut rank_key'e göre
     * yükselen/düşen sayısını, ÖNBELLEKTEN (rank_window_pr/rank_ep) hesaplar. Tek tarama, ucuz.
     *
     * @return array{counts: array<string,int>, down:int, up:int, same:int, total:int, uncached:int}
     */
    public static function previewDistribution(array $ratingMin, array $prMax, array $epMin): array
    {
        $order = array_keys($ratingMin);
        $idx = array_flip($order);
        $counts = array_fill_keys($order, 0);
        $down = $up = $same = $total = $uncached = 0;

        User::query()->where('is_system', false)->whereNotNull('rating')
            ->select(['id', 'rating', 'rank_window_pr', 'rank_ep', 'rank_key'])
            ->chunkById(500, function ($rows) use (&$counts, &$down, &$up, &$same, &$total, &$uncached, $ratingMin, $prMax, $epMin, $idx) {
                foreach ($rows as $u) {
                    $pr = $u->rank_window_pr === null ? null : (float) $u->rank_window_pr;
                    if ($pr === null && $u->rank_ep === null) {
                        $uncached++; // hiç rank:refresh görmemiş -> önbellek yok (provisional gibi sayılır)
                    }
                    $key = self::effectiveKeyFrom((int) $u->rating, $pr, (int) $u->rank_ep, $ratingMin, $prMax, $epMin);
                    $counts[$key] = ($counts[$key] ?? 0) + 1;
                    $total++;
                    $cur = $u->rank_key;
                    if ($cur !== null && isset($idx[$cur], $idx[$key])) {
                        if ($idx[$key] < $idx[$cur]) {
                            $down++;
                        } elseif ($idx[$key] > $idx[$cur]) {
                            $up++;
                        } else {
                            $same++;
                        }
                    }
                }
            });

        return compact('counts', 'down', 'up', 'same', 'total', 'uncached');
    }
}
