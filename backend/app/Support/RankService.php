<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;

/**
 * YENİ rütbe sistemi (rating + PR + EP) ENFORCEMENT'ı — oyuncunun gösterilen rütbe
 * anahtarını (div.*) belirler ve users.rank_key önbelleğine yazar.
 *
 * TOGGLE: `rank_system_active` (admin > Rating Ayar). KAPALI -> effectiveDivKey null döner
 * (users.rank_key null; frontend eski gibi yalnız rating'e göre gösterir -> SIFIR değişiklik).
 * AÇIK -> üç kriter (rating ≥ min, PR ≤ prMax, EP ≥ epMin) sağlanan EN YÜKSEK kademe.
 *
 * PROVISIONAL (kullanıcı direktifi): yeterli analizli maçı olmayan (PR = null) oyuncu
 * CEZALANDIRILMAZ -> rating rütbesini alır (veri gelince otomatik düzelir).
 */
class RankService
{
    public static function active(): bool
    {
        return Setting::get('rank_system_active', '0') === '1';
    }

    /** Rating'in ulaştığı en yüksek kademe anahtarı (frontend rankOf ile AYNI mantık). */
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
     * Yürürlükteki efektif rütbe anahtarı; sistem kapalıysa null (frontend rating'e düşer).
     */
    public static function effectiveDivKey(User $u): ?string
    {
        if (! self::active()) {
            return null;
        }
        $rating = (int) ($u->rating ?? 1500);
        $prog = RankProgress::forUser($u);
        $pr = $prog['window_pr'];
        $ep = (int) $prog['ep'];

        // PR verisi yok -> provisional: rating rütbesi (ceza yok).
        if ($pr === null) {
            return self::ratingDivKey($rating);
        }

        $prMax = RankDivisions::prThresholds(); // rookie YOK (sonsuz)
        $epMin = RankDivisions::epThresholds();
        $key = 'div.rookie';
        foreach (RankDivisions::thresholds() as $k => $min) {
            if ($rating < $min) {
                continue;
            }
            if ($pr > ($prMax[$k] ?? INF)) {   // rookie prMax yok -> sonsuz, hep geçer
                continue;
            }
            if ($ep < (int) ($epMin[$k] ?? 0)) {
                continue;
            }
            $key = $k;
        }

        return $key;
    }

    /** Bir oyuncunun rank_key önbelleğini yeniden hesapla + kaydet. */
    public static function refresh(User $u): void
    {
        $key = self::effectiveDivKey($u);
        if ($u->rank_key !== $key) {
            $u->forceFill(['rank_key' => $key])->save(); // rank_key $fillable değil
        }
    }

    /** TÜM oyuncular için yeniden hesapla (toggle değişince / backfill). Sayı döner. */
    public static function refreshAll(int $chunk = 200): int
    {
        $count = 0;
        User::query()->select(['id', 'rating', 'rank_key'])->chunkById($chunk, function ($users) use (&$count) {
            foreach ($users as $u) {
                self::refresh($u);
                $count++;
            }
        });

        return $count;
    }
}
