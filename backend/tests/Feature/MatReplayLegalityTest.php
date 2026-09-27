<?php

namespace Tests\Feature;

use App\Support\Backgammon;
use App\Support\MatBuilder;
use Tests\TestCase;

/**
 * .mat DIŞA AKTARIM REGRESYONU (VFE5U / LW3ZZ, kök neden 2026-09-27).
 *
 * KÖK NEDEN: ZORUNLU (tek-yasal-hamle) ve dance turları rich maç loguna YALNIZ `fill:true` girdisi
 * olarak yazılıyordu (recordPR zorunlu/dance'i atlar). gnubg-native export (`MatBuilder`) tüm `fill`
 * girdilerini siliyordu -> bardan zorunlu giriş / zorunlu bear-off gibi GERÇEK tahta değişiklikleri
 * kayboluyordu. Sonuç: sonraki hamle "boş haneden" görünüyor, oyunlar 15 taş toplanmadan yarım
 * kalıyor, kazandıran son hamle düşünce sonuç NULL oluyordu.
 *
 * Bu test gerçek iki maçı (fixture) baştan sona YENİDEN OYNATIR: her hamlede kaynak hanede taş var
 * mı, hedef açık mı, kullanılan zar doğru mu; yeni oyun ancak önceki gerçekten bitince mi açılıyor;
 * skor doğru taşınıyor mu. Ayrıca zorunlu-hamle dahil/ pure-dance hariç davranışını sınar.
 */
class MatReplayLegalityTest extends TestCase
{
    // ----- crafted (küçük, deterministik) senaryolar -----

    public function test_forced_reentry_move_is_included_in_gnubg_mat(): void
    {
        // Siyah barda, 4 ile TEK yasal giriş (bar/21) -> recordPR atlar, log'da yalnız fill:true.
        // Eskiden gnubg .mat'ten düşüyordu; artık DAHİL olmalı.
        $log = [
            ['player' => 'white', 'notation' => '13/11 24/23', 'dice' => [2, 1], 'seq' => 0, 'pos' => Backgammon::initialState()],
            ['player' => 'black', 'notation' => 'bar/21', 'dice' => [6, 4], 'seq' => 1, 'fill' => true,
                'pos' => ['points' => [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2],
                    'bar' => ['white' => 0, 'black' => 1], 'off' => ['white' => 0, 'black' => 0]]],
        ];
        $mat = MatBuilder::build($log, 5, 'W', 'B');
        $this->assertStringContainsString('bar/21', $mat, 'Zorunlu bardan-giriş (fill) gnubg .mat\'e girmeli');
    }

    public function test_pure_dance_fill_is_excluded(): void
    {
        // Hamlesiz (notation boş) fill = pure-dance: tahta değişmez, .mat'e YAZILMAMALI (baseline).
        $log = [
            ['player' => 'white', 'notation' => '8/5 6/5', 'dice' => [3, 1], 'seq' => 0, 'pos' => Backgammon::initialState()],
            ['player' => 'black', 'notation' => '', 'dice' => [6, 6], 'seq' => 1, 'fill' => true,
                'pos' => Backgammon::initialState()],
        ];
        $mat = MatBuilder::build($log, 5, 'W', 'B');
        // Siyah sütununda dance için ekstra hamle satırı olmamalı (yalnız beyazın turu görünür).
        $this->assertStringContainsString('8/5 6/5', $mat);
        $this->assertStringNotContainsString('66:', $mat, 'Pure-dance fill .mat\'e yazılmamalı');
    }

    // ----- gerçek maç fixture'ları: baştan sona replay yasallığı -----

    public function test_vfe5u_exports_and_replays_legally(): void
    {
        [$mat, $score] = $this->buildMerged('vfe5u', 5);
        $this->assertReplaysLegally($mat);
        // Üç oyun da sonuçlanmalı (concern #2/#4) + skor 10-0 (concern DB).
        $this->assertEveryNonFinalGameResolved($mat);
        $this->assertSame([10, 0], $score, 'VFE5U skoru 10-0 olmalı (1+1+8)');
    }

    public function test_lw3zz_exports_and_replays_legally(): void
    {
        [$mat, $score] = $this->buildMerged('lw3zz', 5);
        $this->assertReplaysLegally($mat);
        $this->assertEveryNonFinalGameResolved($mat);
        // Ömer 8 (2+6), Özkan 2 -> beyaz=Özkan=2, siyah=Ömer=8.
        $this->assertSame([2, 8], $score, 'LW3ZZ skoru 2-8 olmalı');
    }

    /** İki istemci logunu (fixture) merge edip .mat + final skor döndürür. */
    private function buildMerged(string $code, int $len): array
    {
        $dir = base_path('tests/Fixtures');
        $black = json_decode((string) file_get_contents("$dir/mat-regression-$code.json"), true);
        $white = json_decode((string) file_get_contents("$dir/mat-regression-$code-white.json"), true);
        $this->assertIsArray($black);
        $this->assertIsArray($white);
        $merged = MatBuilder::mergeLogs($white, $black);
        $mat = MatBuilder::build($merged, $len, 'OzkanKayaci', 'OmerDOGAN');

        return [$mat, $this->finalScore($mat)];
    }

    // =====================================================================
    // .mat REPLAY DOĞRULAYICI (gnubg lehçesi)
    // =====================================================================

    private function assertReplaysLegally(string $mat): void
    {
        $violations = $this->replayViolations($mat);
        $this->assertSame([], $violations, "Dışa aktarılan .mat baştan sona YASAL oynatılamıyor:\n".implode("\n", $violations));
    }

    /** Her (SON-olmayan) oyunun bir sonuç ("Wins") satırı olmalı — yarım oyun sınırı yok. */
    private function assertEveryNonFinalGameResolved(string $mat): void
    {
        $blocks = $this->gameBlocks($mat);
        foreach ($blocks as $gi => $b) {
            $isFinal = $gi === array_key_last($blocks);
            $hasWin = (bool) preg_grep('/Wins \d+ point/', $b['lines']);
            if (! $isFinal) {
                $this->assertTrue($hasWin, 'Oyun '.($gi + 1).' sonuçsuz (yarım oyun sınırı) — bir sonraki oyun başlıyor');
            }
        }
    }

    /**
     * .mat'i baştan sona oynatıp yasa ihlallerini döndürür (boş = temiz).
     *
     * @return list<string>
     */
    private function replayViolations(string $mat): array
    {
        $violations = [];
        foreach ($this->gameBlocks($mat) as $gi => $block) {
            $state = Backgammon::initialState();
            foreach ($block['turns'] as $turn) {
                foreach (['white', 'black'] as $pl) {
                    $cell = $turn[$pl] ?? '';
                    $err = $this->applyCell($state, $cell, $pl);
                    if ($err !== null) {
                        $violations[] = "Oyun ".($gi + 1)." tur {$turn['n']} ($pl '$cell'): $err";
                    }
                }
            }
        }

        return $violations;
    }

    /** .mat metnini oyun bloklarına ayır (her blok: lines[] + turns[{n,white,black}]). */
    private function gameBlocks(string $mat): array
    {
        $lines = explode("\n", $mat);
        $blocks = [];
        $cur = null;
        foreach ($lines as $line) {
            if (preg_match('/^ Game \d+$/', $line)) {
                if ($cur !== null) {
                    $blocks[] = $cur;
                }
                $cur = ['lines' => [], 'turns' => []];

                continue;
            }
            if ($cur === null) {
                continue;
            }
            $cur['lines'][] = $line;
            if (preg_match('/^\s*(\d+)\) (.*)$/', $line, $m)) {
                $n = (int) $m[1];
                // Sabit sütun: beyaz = [5,39), siyah = [39,). (COLW=34, "%3d) " = 5)
                $white = trim(substr($line, 5, 34));
                $black = trim(substr($line, 39));
                $cur['turns'][] = ['n' => $n, 'white' => $white, 'black' => $black];
            }
        }
        if ($cur !== null) {
            $blocks[] = $cur;
        }

        return $blocks;
    }

    /**
     * Bir hücreyi ($cell = "62: bar/23 21/15" | "Doubles => 2" | "Takes" | "62:" | "") oyna.
     * Yasa dışıysa hata metni, temizse null döner. Küp/boş hücreler no-op.
     */
    private function applyCell(array &$state, string $cell, string $player): ?string
    {
        if ($cell === '' || ! str_contains($cell, ':')) {
            return null; // Doubles/Takes/Drops/boş -> tahta değişmez
        }
        [$diceRaw, $movesRaw] = array_pad(explode(':', $cell, 2), 2, '');
        $diceRaw = trim($diceRaw);
        $movesRaw = trim($movesRaw);
        if ($movesRaw === '' || $movesRaw === 'pas' || $movesRaw === 'pass') {
            return null; // dance / dice-only
        }
        // Zar havuzu (çift -> 4 zar).
        $digits = preg_replace('/\D/', '', $diceRaw) ?? '';
        if (strlen($digits) < 2) {
            return "zar okunamadı '$diceRaw'";
        }
        $d1 = (int) $digits[0];
        $d2 = (int) $digits[1];
        $dice = $d1 === $d2 ? [$d1, $d1, $d1, $d1] : [$d1, $d2];

        $sign = $player === 'white' ? 1 : -1;
        // Tüm alt-adımları topla, sonra AÇGÖZLÜ uygula: gnubg çift-zar notasyonu ("7/4(2) 10/7(2)")
        // soldan-sağa yürütülemeyebilir (aynı taş 10→7→4). Her turda uygulanabilir bir adımı seç.
        $pending = [];
        foreach (preg_split('/\s+/', $movesRaw, -1, PREG_SPLIT_NO_EMPTY) as $tok) {
            foreach ($this->expandToken($tok) as $step) {
                $pending[] = $step;
            }
        }
        while ($pending) {
            $appliedIdx = null;
            foreach ($pending as $k => $step) {
                if ($this->stepError($state, $step[0], $step[1], $player, $sign, $dice) === null) {
                    $appliedIdx = $k;
                    break;
                }
            }
            if ($appliedIdx === null) {
                // Hiçbiri uygulanamıyor -> ilkinin sebebini bildir.
                return $this->stepError($state, $pending[0][0], $pending[0][1], $player, $sign, $dice);
            }
            $step = $pending[$appliedIdx];
            $this->doStep($state, $step[0], $step[1], $player, $sign, $dice);
            unset($pending[$appliedIdx]);
            $pending = array_values($pending);
        }

        return null;
    }

    /** "8/3(2)" -> [["8","3"],["8","3"]]; "bar/21" -> [["bar","21"]]; "6/off*" -> [["6","off"]]. */
    private function expandToken(string $tok): array
    {
        $tok = str_replace('*', '', $tok);
        if (! preg_match('/^(.+?)(?:\((\d+)\))?$/', $tok, $m)) {
            return [];
        }
        $parts = explode('/', $m[1]);
        $n = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 1;
        $out = [];
        // Çok-atlamalı ("bar/24 24/23" tek token değil ama "a/b/c" olursa parçala).
        for ($i = 0; $i + 1 < count($parts); $i++) {
            $seg = [[$parts[$i], $parts[$i + 1]]];
            $out = array_merge($out, $seg);
        }
        // (n) tekrarı: tek-atlamalı token için.
        if ($n > 1 && count($parts) === 2) {
            $out = array_fill(0, $n, [$parts[0], $parts[1]]);
        }

        return $out;
    }

    /** Tek adım YASAL mı? Değilse hata metni, yasalsa null (tahtayı DEĞİŞTİRMEZ). */
    private function stepError(array $state, string $from, string $to, string $player, int $sign, array $dice): ?string
    {
        // --- kaynak ---
        if ($from === 'bar') {
            if ((int) ($state['bar'][$player] ?? 0) < 1) {
                return "barda taş yok ama bar/$to";
            }
        } else {
            $fi = $this->toIndex($from, $player);
            if ($fi === null) {
                return "geçersiz kaynak '$from'";
            }
            $v = (int) $state['points'][$fi];
            if ($sign > 0 ? $v <= 0 : $v >= 0) {
                return "kaynak hane $from (idx $fi) boş/rakip (points=$v)";
            }
        }
        // Barda taş varken bar-dışı hamle yasak (önce gir).
        if ($from !== 'bar' && (int) ($state['bar'][$player] ?? 0) > 0) {
            return "barda taş varken $from/$to oynanamaz";
        }
        $toIdx = $to === 'off' ? null : $this->toIndex($to, $player);
        if ($to !== 'off' && $toIdx === null) {
            return "geçersiz hedef '$to'";
        }
        $pip = $this->pip($from, $to, $player);
        if ($pip < 1) {
            return "pip hesaplanamadı $from/$to";
        }
        if ($toIdx !== null) {
            $tv = (int) $state['points'][$toIdx];
            if ($sign > 0 ? $tv <= -2 : $tv >= 2) {
                return "hedef $to (idx $toIdx) rakip tarafından kapalı (points=$tv)";
            }
        }
        if ($this->pickDie($dice, $pip, $to === 'off') === null) {
            return "kullanılan zar ($pip) mevcut zarlarda yok [".implode(',', $dice)."] ($from/$to)";
        }

        return null;
    }

    /** Adımı uygula (yasal varsayılır): kaynak-hedef güncelle, vuruşu bara gönder, zarı tüket. */
    private function doStep(array &$state, string $from, string $to, string $player, int $sign, array &$dice): void
    {
        $opp = $player === 'white' ? 'black' : 'white';
        $toIdx = $to === 'off' ? null : $this->toIndex($to, $player);
        $pip = $this->pip($from, $to, $player);
        $di = $this->pickDie($dice, $pip, $to === 'off');
        if ($di !== null) {
            unset($dice[$di]);
            $dice = array_values($dice);
        }
        if ($from === 'bar') {
            $state['bar'][$player]--;
        } else {
            $state['points'][$this->toIndex($from, $player)] -= $sign;
        }
        if ($to === 'off') {
            $state['off'][$player]++;

            return;
        }
        $tv = (int) $state['points'][$toIdx];
        if (($sign > 0 && $tv === -1) || ($sign < 0 && $tv === 1)) {
            $state['points'][$toIdx] = 0; // vuruş
            $state['bar'][$opp]++;
        }
        $state['points'][$toIdx] += $sign;
    }

    /** Kullanılacak zarın indeksi: tam eşleşme; bear-off ise pip<=zar da kabul. Yoksa null. */
    private function pickDie(array $dice, int $pip, bool $isOff): ?int
    {
        $di = array_search($pip, $dice, true);
        if ($di !== false) {
            return $di;
        }
        if ($isOff) {
            foreach ($dice as $k => $dv) {
                if ($dv >= $pip) {
                    return $k;
                }
            }
        }

        return null;
    }

    /** Oyuncu perspektifli nokta (1-24) -> iç indeks (0-23). white: p-1, black: 24-p. */
    private function toIndex(string $point, string $player): ?int
    {
        if (! ctype_digit($point)) {
            return null;
        }
        $p = (int) $point;
        if ($p < 1 || $p > 24) {
            return null;
        }

        return $player === 'white' ? $p - 1 : 24 - $p;
    }

    /** Adımın kullandığı zar (pip). bar/off dahil, perspektife göre. */
    private function pip(string $from, string $to, string $player): int
    {
        // İç indeks uzayında hesapla; bar/off için sanal uç noktalar.
        if ($player === 'white') {
            $f = $from === 'bar' ? 24 : (int) $from - 1;      // white bar = idx 24 (üst uç)
            $t = $to === 'off' ? -1 : (int) $to - 1;          // white off = idx -1 (alt uç)

            return $f - $t;
        }
        $f = $from === 'bar' ? -1 : 24 - (int) $from;         // black bar = idx -1
        $t = $to === 'off' ? 24 : 24 - (int) $to;             // black off = idx 24

        return $t - $f;
    }

    /** .mat'ten final skoru (beyaz, siyah) çıkar: her oyunun "Wins N" satırı + sütun konumu. */
    private function finalScore(string $mat): array
    {
        $sw = 0;
        $sb = 0;
        foreach (explode("\n", $mat) as $line) {
            if (! preg_match('/Wins (\d+) point/', $line, $m)) {
                continue;
            }
            $pts = (int) $m[1];
            // gnubg: beyaz kazanınca "      Wins" (COLW öncesi); siyah kazanınca COLW dolgulu.
            $pos = strpos($line, 'Wins');
            if ($pos !== false && $pos > 20) {
                $sb += $pts;
            } else {
                $sw += $pts;
            }
        }

        return [$sw, $sb];
    }
}
