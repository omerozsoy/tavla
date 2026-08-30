<?php

namespace App\Analysis;

use App\Support\ErrorJournalConfig as Cfg;

/**
 * Pozisyon Siniflandirici (brief §5-21).
 *
 * Girdi: PositionFeatureExtractor::extract() ciktisi (tek ozellik katmani).
 * Cikti: ['primaryCategory' => string, 'tags' => string[]].
 *
 * Bir pozisyon birden fazla kategoriye girebilir; primaryCategory Cfg::PRECEDENCE
 * sirasiyla secilir, kalan eslesmeler + yapisal isaretler secondary tag olur.
 *
 * Kesin (deterministic) kategoriler: race, six_prime, deep_anchor, holding_game,
 *   mutual_holding, one_checker_back, close_out(*), endgame_contact, middle_game.
 * Sezgisel (heuristic) kategoriler: opening, blitz_*, attacking_game, backgame_*, crunch,
 *   late_game_hit(*). (*) dice/event gerektirenler pozisyon-temelli yaklasik.
 */
final class PositionClassifier
{
    /**
     * @param  array  $f  PositionFeatures
     * @param  string  $player  'white'|'black'
     * @param  string|null  $prevCategory  ayni maçtaki bir onceki kararin kategorisi (hysteresis)
     * @return array{primaryCategory:string, tags:array<string>}
     */
    public static function classify(array $f, string $player, ?string $prevCategory = null): array
    {
        $match = self::detect($f, $player, $prevCategory);

        // Precedence: ilk true olan primary.
        $primary = Cfg::CAT_MIDDLE_GAME;
        foreach (Cfg::PRECEDENCE as $cat) {
            if (! empty($match[$cat])) {
                $primary = $cat;
                break;
            }
        }

        // Secondary tag'ler: primary disindaki eslesen kategoriler (middle_game haric)
        $tags = [];
        foreach ($match as $cat => $on) {
            if ($on && $cat !== $primary && $cat !== Cfg::CAT_MIDDLE_GAME) {
                $tags[] = $cat;
            }
        }
        // Yapisal isaretler
        foreach (self::structuralTags($f) as $tag) {
            $tags[] = $tag;
        }

        return ['primaryCategory' => $primary, 'tags' => array_values(array_unique($tags))];
    }

    /** Her kategori icin boolean eslesme haritasi. */
    private static function detect(array $f, string $player, ?string $prevCategory): array
    {
        $white = $player === 'white';
        $myHome = $white ? range(0, 5) : range(18, 23);
        $oppBlotsInMyHome = count(array_intersect($f['opponentBlots'], $myHome));

        $anchorCount = count($f['myAnchors']);
        $contact = $f['contactExists'];

        // --- YARIS ---
        $race = $f['pureRace'];

        // --- ACILIS (heuristic): ilk ply'lar + baslangica yakin + bar yok + yapilar olusmamis ---
        $opening = ! $race
            && $f['plyNumber'] <= Cfg::OPENING_MAX_PLY
            && $f['myBarCheckers'] === 0 && $f['opponentBarCheckers'] === 0
            && $f['myHomeBoardPointsMade'] <= 1 && $f['opponentHomeBoardPointsMade'] <= 1
            && $f['combinedPipCount'] >= 300;

        // Acilis penceresinde (ply<=3, board gelismemis) baslangicin arka taslari teknik
        // olarak anchor gorunur; ama bu bir "tutma/karsilikli tutma" degil, ACILIStir.
        // Opening baskin olsun diye holding-ailesini bastirip erken donuyoruz (brief §6).
        if ($opening) {
            return self::baseMap([Cfg::CAT_OPENING => true]);
        }

        // --- 6 KAPI ---
        $sixPrime = $f['mySixPrime'];

        // --- KAPATMA (close_out*): rakip bar'da + 5 home point (6.'yi yapma firsati) ---
        $closeOut = $f['opponentBarCheckers'] > 0 && $f['myHomeBoardPointsMade'] === 5;

        // --- BLITZ (heuristic): rakip bar'da/blot baski altinda + guclu home + guvenli anchor yok ---
        $underAttack = $f['opponentBarCheckers'] > 0 || $oppBlotsInMyHome >= 1;
        $oppHasSafeAnchor = count($f['opponentAnchors']) > 0;
        $blitzBase = $contact && $underAttack && ! $oppHasSafeAnchor && $f['myHomeBoardPointsMade'] >= 2;
        // erken: board esnek, spare var, home tam gelismemis; gec: daha cok home point, timing dusuk
        $blitzEarly = $blitzBase && $f['myHomeBoardPointsMade'] <= 3 && $f['myOuterBoardSpares'] >= 1;
        $blitzMidLate = $blitzBase && ! $blitzEarly;

        // --- SALDIRI OYUNU (heuristic): blitz kadar gelismemis ama vurus baskisi var ---
        $attacking = ! $blitzBase && $contact && $f['hitPossible']
            && ! empty($f['opponentBlots']) && $f['myHomeBoardPointsMade'] >= 1;

        // --- KARSILIKLI TUTMA: iki taraf da karsi home'da anchor tutuyor ---
        $mutualHolding = $anchorCount >= 1 && count($f['opponentAnchors']) >= 1;

        // --- DERIN ANKOR: tek anchor ve derin (rakip 1/2/3) ---
        $deepAnchor = $anchorCount === 1 && ! empty($f['myDeepAnchors']);

        // --- TUTMA OYUNU: tek anchor ve ileri (rakip 4/5/6) ---
        $holding = $anchorCount === 1 && ! empty($f['myAdvancedAnchors']);

        // --- GERI TEK PUL: geride tek tas (blot), bar yok ---
        $oneCheckerBack = $f['myCheckersBack'] === 1 && $f['myBarCheckers'] === 0;

        // --- GERI OYUN (heuristic): 2+ anchor rakip home'da ---
        $backgame = $anchorCount >= Cfg::BACKGAME_MIN_ANCHORS;
        $timingLow = $f['myOuterBoardSpares'] <= 1 || $f['opponentBorneOff'] > 0
            || $f['opponentPipCount'] < 90;
        $backgameLate = $backgame && $timingLow;
        $backgameEarly = $backgame && ! $backgameLate;
        // Not: 2+ anchor'da deep_anchor/holding zaten false (anchorCount==1 gerektirir);
        // backgame precedence'ta mutual_holding'in de ustunde -> ayrica bastirmaya gerek yok.
        // mutual_holding secondary tag olarak kalabilir.

        // --- CRUNCH (heuristic): timing tukendi, spare yok, geride cok tas, pip aciligi buyuk ---
        $crunch = $contact
            && $f['myCheckersBack'] >= 3
            && $f['myOuterBoardSpares'] === 0
            && ($f['myPipCount'] - $f['opponentPipCount']) > 40
            && $f['myHomeBoardPointsMade'] >= 3;

        // --- OYUN SONU TEMAS (hysteresis'li) ---
        $pipMax = Cfg::ENDGAME_PIP_MAX;
        if ($prevCategory === Cfg::CAT_ENDGAME_CONTACT) {
            $pipMax += Cfg::ENDGAME_PIP_HYSTERESIS; // kalmaya devam etmesi kolay
        } elseif ($prevCategory === Cfg::CAT_MIDDLE_GAME) {
            $pipMax -= Cfg::ENDGAME_PIP_HYSTERESIS; // gecis icin daha dusuk esik
        }
        $endgameContact = $contact && $f['combinedPipCount'] <= $pipMax;

        // --- GEC OYUN VURUSU (event, heuristic): gec asamada kritik vurus firsati ---
        $lateGameHit = $contact && $f['hitPossible']
            && ($f['opponentBorneOff'] > 0 || $endgameContact);

        return [
            Cfg::CAT_CLOSE_OUT => $closeOut,
            Cfg::CAT_LATE_GAME_HIT => $lateGameHit,
            Cfg::CAT_SIX_PRIME => $sixPrime,
            Cfg::CAT_CRUNCH => $crunch,
            Cfg::CAT_BACKGAME_LATE => $backgameLate,
            Cfg::CAT_BACKGAME_EARLY => $backgameEarly,
            Cfg::CAT_BLITZ_MID_LATE => $blitzMidLate,
            Cfg::CAT_BLITZ_EARLY => $blitzEarly,
            Cfg::CAT_MUTUAL_HOLDING => $mutualHolding,
            Cfg::CAT_DEEP_ANCHOR => $deepAnchor,
            Cfg::CAT_HOLDING => $holding,
            Cfg::CAT_ONE_CHECKER_BACK => $oneCheckerBack,
            Cfg::CAT_ATTACKING => $attacking,
            Cfg::CAT_ENDGAME_CONTACT => $endgameContact,
            Cfg::CAT_RACE => $race,
            Cfg::CAT_OPENING => $opening,
            Cfg::CAT_MIDDLE_GAME => true, // her zaman fallback dogru
        ];
    }

    /**
     * Tum kategori anahtarlarini iceren harita; middle_game=true (fallback), digerleri false.
     * $overrides ile istenen kategoriler true yapilir.
     * @param  array<string,bool>  $overrides
     */
    private static function baseMap(array $overrides = []): array
    {
        $map = array_fill_keys(Cfg::CATEGORY_ORDER, false);
        $map[Cfg::CAT_MIDDLE_GAME] = true;

        return array_merge($map, $overrides);
    }

    /** Yapisal secondary tag'ler (brief §21 ornegi). */
    private static function structuralTags(array $f): array
    {
        $tags = [];
        if ($f['opponentBarCheckers'] > 0) { $tags[] = 'opponent_on_bar'; }
        if ($f['myBarCheckers'] > 0) { $tags[] = 'on_bar'; }
        if ($f['hitPossible']) { $tags[] = 'hit_available'; }
        if ($f['myHomeBoardPointsMade'] >= 1) {
            $tags[] = $f['myHomeBoardPointsMade'].'_point_board';
        }
        if (! empty($f['myAnchors'])) { $tags[] = 'holds_anchor'; }
        if ($f['bearingOffStarted']) { $tags[] = 'bearing_off'; }

        return $tags;
    }
}
