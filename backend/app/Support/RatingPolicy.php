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
 *  - Misafir (hesapsız) rakip/oyuncu: puansız. Misafir arkadaş odasına kodla girebilir; eskiden
 *    "limit sayılamaz, puanlı say" deniyordu -> kendi ikinci tarayıcısındaki misafire bilerek
 *    kaybettirip SINIRSIZ rating/PR kasılabiliyordu (misafir rating'i de istemciden geliyor).
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

    /** Elo K katsayısı (maç uzunluğundan BAĞIMSIZ; uzunluk etkisi C katsayısıyla gelir). */
    public const ELO_K = 32;

    /** Rating tabanı: hiçbir oyuncu bunun altına düşmez. */
    public const RATING_FLOOR = 100;

    /** Maç uzunluğu katsayısının referans uzunluğu (C = sqrt(L / REF), REF=3 -> 3'lük maç C=1). */
    public const LENGTH_REF = 3;

    /**
     * Maç uzunluğu (hedef puan) katsayısı: C = sqrt(L / 3). Uzun maçlar hem kazancı hem kaybı
     * büyütür (daha güvenilir sonuç). L = maç BAŞINDA belirlenen hedef puan (oynanan el/süre/küp/
     * final skoru DEĞİL). L<1 anlamsız -> en az 1. TavlaTV'nin puanlama tercihidir; evrensel tavla
     * standardı değildir.
     */
    public static function lengthFactor(int $length): float
    {
        return sqrt(max(1, $length) / self::LENGTH_REF);
    }

    /**
     * Kazanandan kaybedene aktarılacak rating miktarı — POZİTİF, yuvarlanmış, SİMETRİ GARANTİLİ.
     * Hem kazanan hem kaybeden bu TEK değeri kullanır: kazanan +transfer, kaybeden −transfer.
     * Böylece (yuvarlama yalnız burada, kazanan perspektifinden yapıldığından) negatifte yuvarlama
     * farkı oluşmaz -> kazancın mutlak değeri = kaybın mutlak değeri.
     *
     *   E = kazananın beklenen kazanma olasılığı = 1 / (1 + 10^((kaybedenR − kazananR)/400))
     *   transfer = round(K × C × (1 − E))              (ara adımlarda yuvarlama YOK)
     *
     * NOT: Taban (RATING_FLOOR) kaybedene uygulanınca bu eşitlik bozulabilir — bkz eloNewRating.
     */
    public static function ratingTransfer(int $winnerRating, int $loserRating, int $length): int
    {
        $expectedWinner = 1 / (1 + pow(10, ($loserRating - $winnerRating) / 400));

        return (int) round(self::ELO_K * self::lengthFactor($length) * (1 - $expectedWinner));
    }

    /**
     * Elo sonrası yeni rating — TEK formül. reportRating/ForfeitLoss/MatchBackstop bunu uygular;
     * davet kartı önizlemesi (eloPreview) de -> gösterilen +/- ile gerçekte işlenen AYNI.
     *
     * Transfer DAİMA kazanan perspektifinden hesaplanır (simetri): $won ise self=kazanan, değilse
     * self=kaybeden. Yeni rating = eski ± transfer, sonra tabana (100) kırpılır.
     *
     * TABAN & SİMETRİ: Kaybeden tabana dayanırsa (ör. 105 -> −12 istenir ama taban 100) kaybeden
     * yalnız −5 kaybeder; kazanan yine tam +transfer kazanır. Bu bilinçli: taban korunur, fiyatı da
     * o nadir sınır durumunda kazanç>kayıp eşitsizliğidir (mevcut taban davranışı KORUNDU).
     */
    public static function eloNewRating(int $ra, int $rb, bool $won, int $length): int
    {
        $transfer = $won
            ? self::ratingTransfer($ra, $rb, $length)   // self kazandı: self=kazanan, rakip=kaybeden
            : self::ratingTransfer($rb, $ra, $length);  // self kaybetti: rakip=kazanan, self=kaybeden

        return max(self::RATING_FLOOR, $ra + ($won ? $transfer : -$transfer));
    }

    /**
     * $ra rating'li oyuncunun $rb'ye karşı $length puanlık maçta kazanırsa/kaybederse rating değişimi.
     *
     * @return array{win:int, loss:int} win >= 0, loss <= 0
     */
    public static function eloPreview(int $ra, int $rb, int $length): array
    {
        return [
            'win' => self::eloNewRating($ra, $rb, true, $length) - $ra,
            'loss' => self::eloNewRating($ra, $rb, false, $length) - $ra,
        ];
    }

    /** Site Ayarları'ndaki 24 saatlik aynı-rakip limiti (>=0). */
    public static function friendlyDailyLimit(): int
    {
        return max(0, Setting::int(self::SETTING_KEY, self::DEFAULT_LIMIT));
    }

    /**
     * Bu maç, bu oyuncu için PUANLI mı (rating + PR kredisi uygulanmalı mı)?
     *
     * @param  Room  $room  maç odası
     * @param  int  $userId  raporlayan/işlenen oyuncu
     * @param  int  $opponentId  rakip hesap id (0/negatif = misafir -> puansız)
     */
    public static function isRanked(Room $room, int $userId, int $opponentId): bool
    {
        if ($room->bot) {
            return false; // PvB puansız
        }
        if ($room->unrated) {
            return false; // oda kurucusu "puansız" seçti (Arkadaşınla Oyna) -> rating yok, PR kariyere girmez
        }
        if ($userId <= 0 || $opponentId <= 0) {
            return false; // misafir (hesapsız) taraf -> puansız: anti-farm, misafir rating'i doğrulanamaz
        }
        if ($room->mode !== 'friendly') {
            return true; // eşleşme (ranked) + turnuva (NULL) -> limitsiz puanlı
        }
        // Friendly (kılıç + özel oda): aynı-rakip 24h limiti (iki taraf da hesaplı; misafir yukarıda elendi).
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
