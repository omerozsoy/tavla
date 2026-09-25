<?php

namespace App\Support;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\Setting;
use Illuminate\Support\Facades\Schema;

/**
 * PUANLI (rating + PR) MI? — TEK doğruluk kaynağı. Üç yazım yolu (reportRating, MatchBackstop,
 * ForfeitLoss) bunu kullanır -> kural bir yerde.
 *
 * KURAL:
 *  - Bot (PvB): puansız.
 *  - Eşleşme (mode='ranked') + Turnuva (mode=NULL): PUANLI, limitsiz (rakip rastgele -> farm yok).
 *  - Arkadaş/Kılıç (mode='friendly', SEÇİLEN rakip): PUANLI ama ANTI-FARM limiti — aynı rakiple
 *    son 24 SAATTE en fazla `friendly_rating_daily_limit` (Site Ayarları, varsayılan 3) kez
 *    rating/PR kazanılır; sonrası CASUAL (delta=0, PR kredilenmez). Kılıç ve özel oda AYNI kurala
 *    tabidir (ikisi de seçilen-rakip -> farm riski aynı).
 */
class RatingPolicy
{
    public const SETTING_KEY = 'friendly_rating_daily_limit';
    public const DEFAULT_LIMIT = 3;

    /** Site Ayarları'ndaki 24 saatlik aynı-rakip limiti (>=0). */
    public static function friendlyDailyLimit(): int
    {
        return max(0, Setting::int(self::SETTING_KEY, self::DEFAULT_LIMIT));
    }

    /**
     * Bu maç, bu oyuncu için PUANLI mı (rating + PR kredisi uygulanmalı mı)?
     *
     * @param  Room  $room          maç odası
     * @param  int   $userId        raporlayan/işlenen oyuncu
     * @param  int   $opponentId    rakip hesap id (0/negatif = misafir -> limit uygulanamaz)
     */
    public static function isRanked(Room $room, int $userId, int $opponentId): bool
    {
        if ($room->bot) {
            return false; // PvB puansız
        }
        if ($room->mode !== 'friendly') {
            return true; // eşleşme (ranked) + turnuva (NULL) -> limitsiz puanlı
        }
        // Friendly (kılıç + özel oda): aynı-rakip 24h limiti.
        if ($userId <= 0 || $opponentId <= 0) {
            return true; // rakip/oyuncu hesapsız -> limit sayılamaz, puanlı say
        }
        // Migration henüz koşmadıysa (kolonlar yok) eski-uyumlu: puanlı say (deploy migrate ile düzelir).
        if (! Schema::hasColumn('match_results', 'opponent_user_id') || ! Schema::hasColumn('match_results', 'rated')) {
            return true;
        }
        $limit = self::friendlyDailyLimit();
        if ($limit <= 0) {
            return false; // 0 -> friendly hiç puanlanmaz
        }
        $recent = MatchResult::query()
            ->where('user_id', $userId)
            ->where('opponent_user_id', $opponentId)
            ->where('rated', true)
            ->where('created_at', '>', now()->subDay())
            ->count();

        return $recent < $limit;
    }
}
