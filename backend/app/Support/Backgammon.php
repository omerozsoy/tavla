<?php

namespace App\Support;

/**
 * Sunucu-otoriter oyun durumu yardımcıları (para maçı güvenliği Faz 2b).
 * Motor DEĞİL — yalnız başlangıç kurulumu + oyun-sonu tespiti. Hamle yasallığı Node validator'da.
 *
 * Tahta konvansiyonu (src/engine/types.ts ile AYNI): points[24], pozitif=beyaz, negatif=siyah.
 */
class Backgammon
{
    /** Standart açılış tahtası (src/engine board.ts initialState ile birebir). */
    public static function initialState(): array
    {
        return [
            // src/engine/board.ts initialState ile BİREBİR (index 0=1.üçgen). Beyaz(+): [23]=2,
            // [12]=5, [7]=3, [5]=5; Siyah(-): [0]=-2, [11]=-5, [16]=-3, [18]=-5. (Validator=istemci
            // motoru bu konvansiyonu bekler; TERS dizi hamleyi reddettirir + tahtayı ters gösterir.)
            'points' => [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2],
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 0],
            'turn' => 'white',
            'dice' => [],
            'diceUsed' => [],
        ];
    }

    /** Oyun bitti mi? Biten tarafın rengi ('white'/'black'), yoksa null (15 taş toplandı). */
    public static function winner(array $state): ?string
    {
        $off = $state['off'] ?? [];
        if ((int) ($off['white'] ?? 0) >= 15) {
            return 'white';
        }
        if ((int) ($off['black'] ?? 0) >= 15) {
            return 'black';
        }

        return null;
    }

    /**
     * Oyun puanı (küp ÇARPANI HARİÇ): 1 normal, 2 gammon, 3 backgammon.
     * $winner 15 taşı topladı. Kaybeden:
     *  - en az 1 taş topladıysa -> 1 (normal)
     *  - hiç toplamadı + (bar'da taşı VAR ya da kazananın ev bölgesinde taşı VAR) -> 3 (backgammon)
     *  - hiç toplamadı ama yukarıdakiler yok -> 2 (gammon)
     * Konvansiyon: points[0..5]=beyazın evi, points[18..23]=siyahın evi. (src/engine/cube ile aynı.)
     */
    public static function gamePoints(array $state, string $winner, bool $classic = false): int
    {
        $loser = $winner === 'white' ? 'black' : 'white';
        $off = $state['off'] ?? [];
        if ((int) ($off[$loser] ?? 0) > 0) {
            return 1; // kaybeden bir şey topladı -> normal
        }
        // KLASIK TAVLA ($classic): backgammon-3 YOKTUR -> hiç toplamadı = her zaman 2 (mars).
        // Kaybedenin barda/kazananın evinde taşı marsı 3'e çıkarmaz. (src/engine/board lossMultiplier ile birebir.)
        if ($classic) {
            return 2;
        }
        // Gammon mu backgammon mu? Kaybedenin bar'da ya da KAZANANIN ev bölgesinde taşı var mı?
        $bar = $state['bar'] ?? [];
        if ((int) ($bar[$loser] ?? 0) > 0) {
            return 3; // bar'da taş -> backgammon
        }
        $points = $state['points'] ?? [];
        // Kazananın ev bölgesi indeksleri + kaybedenin taşının işareti.
        $range = $winner === 'white' ? range(0, 5) : range(18, 23);
        foreach ($range as $i) {
            $v = (int) ($points[$i] ?? 0);
            $loserHere = $loser === 'white' ? $v > 0 : $v < 0;
            if ($loserHere) {
                return 3; // kazananın evinde kaybeden taşı -> backgammon
            }
        }

        return 2; // hiç toplamadı, bar/ev yok -> gammon
    }

    /**
     * SİSTEM-belirlenen pes/timeout değeri (1/2/3): frontend resignationValue (src/engine/resign.ts)
     * ile BİREBİR. TOPLAMA-EVRESİ KAPISI (2026-10-17 geri getirildi): mars/backgammon YALNIZ kazanan
     * gerçekten bear-off evresindeyken (tüm pulları evde VEYA en az 1 toplamış) sayılır; aksi halde
     * erken/orta oyunda pes/timeout SAHTE 2/3 üretmesin -> tekli (1). gamePoints bir oyun-SONU
     * sezgisidir (off=0 + kazananın evinde kaybeden taşı -> 3); açılışta geri taşlar zaten rakip
     * evinde olduğundan kapısız hesap her erken terki backgammon sayardı (standart kural İHLALİ). Kapı
     * para maçında gammon-kaçışını engeller: kazanan gerçekten topluyorsa 2/3 korunur.
     * RoomController::resign (:4235) ve applyClockEnd (:2699, terk/timeout/AFK) bunu OTORİTER kullanır.
     * Doğal oyun-sonu (15 taş) gamePoints ile AYRI hesaplanır, bu kapıdan ETKİLENMEZ.
     */
    public static function resignationValue(array $state, string $winner, bool $classic = false): int
    {
        $base = self::gamePoints($state, $winner, $classic);
        if ($base === 1) {
            return 1;
        }
        $winnerBearing = (int) (($state['off'] ?? [])[$winner] ?? 0) > 0 || self::allHome($state, $winner);

        return $winnerBearing ? $base : 1;
    }

    /**
     * Oyuncunun TÜM pulları ev bölgesinde (ve barında yok) mu? -> bear off yapabilir.
     * (src/engine/board.ts allHome ile BİREBİR: beyaz evi 0..5, siyah evi 18..23.)
     */
    private static function allHome(array $state, string $player): bool
    {
        if ((int) (($state['bar'] ?? [])[$player] ?? 0) > 0) {
            return false;
        }
        $points = $state['points'] ?? [];
        // ev DIŞI aralığı: beyaz 6..23, siyah 0..17
        $range = $player === 'white' ? range(6, 23) : range(0, 17);
        foreach ($range as $i) {
            $v = (int) ($points[$i] ?? 0);
            $here = $player === 'white' ? $v > 0 : $v < 0;
            if ($here) {
                return false;
            }
        }

        return true;
    }
}
