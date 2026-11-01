<?php

namespace App\Support;

use App\Models\Room;

/**
 * PUANLI (rating + PR) MI? — TEK doğruluk kaynağı. Üç yazım yolu (reportRating, MatchBackstop,
 * ForfeitLoss) bunu kullanır -> kural bir yerde.
 *
 * KURAL:
 *  - Bot (PvB): puansız.
 *  - Misafir (hesapsız) rakip/oyuncu: puansız.
 *  - Eşleşme (mode='ranked') + Turnuva (mode=NULL): PUANLI (rakip rastgele -> farm yok).
 *  - Arkadaş/Kılıç/özel oda (mode='friendly'): HER ZAMAN PUANSIZ (2026-11-01 kullanıcı direktifi).
 *    Eskiden aynı-rakiple 24h "puanlı maç" limiti (varsayılan 3) vardı; KALDIRILDI — tüm arkadaşlık
 *    maçları artık puansız (rating değişmez, kariyer PR/sıralamaya girmez; maç yine analiz edilir).
 */
class RatingPolicy
{
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
            return false; // "puansız" oda bayrağı -> rating yok, PR kariyere girmez
        }
        if ($userId <= 0 || $opponentId <= 0) {
            return false; // misafir (hesapsız) taraf -> puansız: misafir rating'i doğrulanamaz
        }

        // Arkadaş/Kılıç/özel oda (mode='friendly'): HER ZAMAN puansız (2026-11-01 direktifi; eski
        // aynı-rakip 24h limiti kaldırıldı). PUANLI yalnız: eşleşme (ranked) + turnuva (mode=NULL).
        return $room->mode !== 'friendly';
    }

    /**
     * Bir PUANSIZ maçın sebebi (rating_reason kolonu): bot|unrated|guest|friendly|casual. Sonuç ekranı
     * "rating neden değişmedi" notunu buna göre yazar. Yalnız rated=false satır yazılırken çağrılır
     * (puanlı maçta çağırma -> NULL sakla). isRanked GATE'İ YOK: çağıran zaten puansız olduğunu bilir.
     * reportRating'teki aynı sıra/mantık (AuthController) burada merkezileşir -> tüm settlement yolları
     * (reportRating/MatchBackstop/ForfeitLoss) AYNI sebebi yazar.
     */
    public static function unratedReason(Room $room, int $opponentId): string
    {
        if ($room->bot) {
            return 'bot';
        }
        if ($room->unrated) {
            return 'unrated';
        }
        if ($opponentId <= 0) {
            return 'guest'; // rakip hesapsız (misafir)
        }

        return $room->mode === 'friendly' ? 'friendly' : 'casual';
    }
}
