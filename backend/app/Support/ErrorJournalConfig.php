<?php

namespace App\Support;

/**
 * Hata Gunlugu (Error Journal) — MERKEZI domain kurallari (tek kaynak).
 *
 * Buradaki esikler frontend ile AYNIDIR (MatchReport.tsx:45-50 / App.tsx:154-159):
 *   perfect  < 0.02   -> hata degil
 *   inaccuracy [0.02, 0.04)
 *   mistake    [0.04, 0.08)
 *   blunder   >= 0.08
 * "Hata" = equityLoss >= ERROR_MIN. Yeni keyfi esik URETME; degisecekse burada degistir.
 *
 * Kategori id'leri (17) brief ile birebir snake_case. Sunucu bu id'yi gonderir;
 * gorunen etiket eslemesi frontend'de (i18n errorJournal.cat.*).
 */
final class ErrorJournalConfig
{
    // --- Equity-loss siddet esikleri (frontend ile ayni) ---------------------
    public const PERFECT_MAX = 0.02;     // altinda: hata sayilmaz
    public const INACCURACY_MAX = 0.04;  // [PERFECT_MAX, bu) -> inaccuracy
    public const MISTAKE_MAX = 0.08;     // [INACCURACY_MAX, bu) -> mistake; ustu blunder
    public const ERROR_MIN = self::PERFECT_MAX; // hata sayilmasi icin alt sinir

    // Analiz surumu: siniflandirma mantigi degisirse artir -> backfill yeniden isler.
    public const ANALYSIS_VERSION = 1;

    // --- 17 kategori id'leri -------------------------------------------------
    public const CAT_OPENING = 'opening';
    public const CAT_MIDDLE_GAME = 'middle_game';
    public const CAT_RACE = 'race';
    public const CAT_BLITZ_EARLY = 'blitz_early';
    public const CAT_BLITZ_MID_LATE = 'blitz_mid_late';
    public const CAT_ATTACKING = 'attacking_game';
    public const CAT_MUTUAL_HOLDING = 'mutual_holding';
    public const CAT_ONE_CHECKER_BACK = 'one_checker_back';
    public const CAT_HOLDING = 'holding_game';
    public const CAT_DEEP_ANCHOR = 'deep_anchor';
    public const CAT_ENDGAME_CONTACT = 'endgame_contact';
    public const CAT_CRUNCH = 'crunch';
    public const CAT_SIX_PRIME = 'six_prime';
    public const CAT_BACKGAME_EARLY = 'backgame_early';
    public const CAT_BACKGAME_LATE = 'backgame_late';
    public const CAT_LATE_GAME_HIT = 'late_game_hit';
    public const CAT_CLOSE_OUT = 'close_out';

    /**
     * Primary category oncelik sirasi (brief §21). Ust siradaki once kazanir.
     * Bir pozisyon birden fazla kategoriye girebilir; primaryCategory bu sirayla secilir,
     * digerleri secondary tag olur.
     */
    public const PRECEDENCE = [
        self::CAT_CLOSE_OUT,
        self::CAT_LATE_GAME_HIT,
        self::CAT_SIX_PRIME,
        self::CAT_CRUNCH,
        self::CAT_BACKGAME_LATE,
        self::CAT_BACKGAME_EARLY,
        self::CAT_BLITZ_MID_LATE,
        self::CAT_BLITZ_EARLY,
        self::CAT_MUTUAL_HOLDING,
        self::CAT_DEEP_ANCHOR,
        self::CAT_HOLDING,
        self::CAT_ONE_CHECKER_BACK,
        self::CAT_ATTACKING,
        self::CAT_ENDGAME_CONTACT,
        self::CAT_RACE,
        self::CAT_OPENING,
        self::CAT_MIDDLE_GAME,
    ];

    /** Tum kategori id'leri (UI'daki "Tum Kategoriler" listesi bu sirayla — brief §29). */
    public const CATEGORY_ORDER = [
        self::CAT_OPENING,
        self::CAT_MIDDLE_GAME,
        self::CAT_RACE,
        self::CAT_BLITZ_EARLY,
        self::CAT_BLITZ_MID_LATE,
        self::CAT_ATTACKING,
        self::CAT_MUTUAL_HOLDING,
        self::CAT_ONE_CHECKER_BACK,
        self::CAT_HOLDING,
        self::CAT_DEEP_ANCHOR,
        self::CAT_ENDGAME_CONTACT,
        self::CAT_CRUNCH,
        self::CAT_SIX_PRIME,
        self::CAT_BACKGAME_EARLY,
        self::CAT_BACKGAME_LATE,
        self::CAT_LATE_GAME_HIT,
        self::CAT_CLOSE_OUT,
    ];

    // --- Sezgisel esikler (configurable — fixture testleriyle kalibre edilir) -
    /** Opening: ilk kac ply icinde ve baslangica ne kadar yakinsa acilis sayilir. */
    public const OPENING_MAX_PLY = 3;

    /** Endgame contact: combined pip bu esigin altina dustuyse ve hala temas varsa. */
    public const ENDGAME_PIP_MAX = 90;
    /** Hysteresis/dead-band: middle<->endgame surekli gecis olmasin diye tampon. */
    public const ENDGAME_PIP_HYSTERESIS = 8;

    /** Backgame: rakip home'da bu kadar (veya fazla) anchor = backgame adayi. */
    public const BACKGAME_MIN_ANCHORS = 2;

    /** siddet bandi: equityLoss -> 'inaccuracy'|'mistake'|'blunder'|null(hata degil). */
    public static function severity(float $loss): ?string
    {
        if ($loss < self::PERFECT_MAX) {
            return null;
        }
        if ($loss < self::INACCURACY_MAX) {
            return 'inaccuracy';
        }
        if ($loss < self::MISTAKE_MAX) {
            return 'mistake';
        }

        return 'blunder';
    }

    /** Bir karar hata mi? (equityLoss esigi) */
    public static function isError(float $loss): bool
    {
        return $loss >= self::ERROR_MIN;
    }
}
