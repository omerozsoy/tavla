<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * KOMPAKT log ADAPTÖRÜ (game_logs {g,s,p,d,m,o,k} turları -> ortak oyun modeli -> MatSerializer
 * 'xg' lehçesi). Serileştirme (satır kurma, küp-çiftleme, zar/hamle dönüşümü, çıktı biçimi) artık
 * MatSerializer'da (TEK KAYNAK); bu sınıf yalnız KAYNAĞA ÖZGÜ işi yapar: kompakt turları oyunlara
 * bölmek ve sonuç türetmek.
 *
 * Neden bu, MatBuilder değil: MatBuilder ZENGİN MoveLogEntry[] (pos/dice/notation/cube) ister ve
 * yalnız match_results.log'da bulunur; oraya erişim online'da room_code ile mümkündür, pvb/local'de
 * game_logs ile HİÇBİR ortak anahtar yoktur. game_logs kompakt turları ise HER maçta vardır ve
 * TAMDIR (online: p1_events[beyaz]+p2_events[siyah] birleşir; pvb/local: tek istemci ikisini de
 * yazar). Böylece yönetim panelinde HER maç için (eski kayıtlar dahil) .mat üretilebilir.
 *
 * OYUN SEGMENTASYONU — KÖK NEDEN DÜZELTMESİ (2026-09-11):
 * Eskiden oyunlar TURLARIN TAŞIDIĞI `g` alanına göre bölünüyordu. `g` her istemcide YEREL bir
 * sayaçtır (App: gameEnd kenarında ++). Online'da bir oyun DROP (küp pas) ile bitince KAZANANIN
 * istemcisinde yerel gameEnd TETİKLENMEZ (sunucu yalnız MAÇ bitişini gameEnd yapar) -> kazananın
 * `g` sayacı ARTMAZ -> sonraki oyunun hamleleri hâlâ g=1 etiketiyle yazılır. İki istemcinin `g`'si
 * KAYAR; (g,s,o) ile birleştirme farklı oyunları İÇ İÇE geçirir (DROP'tan sonra hamle, tek-sütun
 * "oyun", tek gerçek oyunun 3-4 parçaya bölünmesi, sonuçsuz oyun).
 *
 * ÇÖZÜM: `g`'ye GÜVENME. Her istemcinin KENDİ dizisi (p1_events / p2_events) EKLENME SIRASINDA
 * gerçek kronolojik sıradadır; `s` (turnsPlayed) sunucu-otoriterdir ve HER OYUNDA 0'a sıfırlanır.
 * Bu yüzden her diziyi tek tek yürüyüp gerçek oyun indeksini `s`-reset + terminal (end/drop) ile
 * YENİDEN türetiriz (kazananın kaçırdığı gameEnd'e rağmen `s`=0 reset'i sınırı yakalar). Sonra iki
 * dizi (rg, s, o) ile birleşir, içerikçe tekilleşir. Terminal (drop/end) oyunu DERHAL kapatır ->
 * DROP'tan sonra AYNI oyuna hamle yazılmaz. MatBuilder'ın tahta-reset (isOpening) segmentasyonunun
 * kompakt-log karşılığıdır ve tahta pozisyonu gerektirmez.
 */
class MatFromLog
{
    /**
     * İKİ oyuncunun HAM (append-sıralı) dizisinden .mat üretir. matText'in tercih ettiği yol:
     * `g` KAYMASINA dayanıklı segmentasyon (bkz. sınıf başı). Tek istemci (pvb/local) durumunda
     * ikinci dizi boş geçilir.
     *
     * @param  array  $p1Events  slot-p1 istemcisinin turları (append sırası)
     * @param  array  $p2Events  slot-p2 istemcisinin turları (append sırası)
     * @param  array{whiteName?:string,blackName?:string,matchLength?:int,site?:string,matchId?:string,eventDate?:string,eventTime?:string,crawford?:bool}  $opts
     */
    public static function buildFromEvents(array $p1Events, array $p2Events, array $opts = []): string
    {
        return self::renderModel(self::segmentGames($p1Events, $p2Events), $opts);
    }

    /**
     * GERİYE UYUMLU giriş: TEK, önceden birleştirilmiş/sıralı tur dizisi (GameLog::mergedTurns()
     * çıktısı ya da test fixture'ı). Segmentasyon yine `g`'ye KÖRÜ KÖRÜNE güvenmez; verilen SIRA
     * korunarak terminal (end/drop) + `g` değişimi + `s`-reset ile durum-makinesiyle bölünür.
     *
     * @param  array  $turns  kronolojik sıralı kompakt turlar
     * @param  array  $opts
     */
    public static function build(array $turns, array $opts = []): string
    {
        return self::renderModel(self::stateMachineSplit($turns), $opts);
    }

    /** Kanonik zar — geriye uyumlu genel API (bkz. MatFromLogTest). MatSerializer'a devreder. */
    public static function xgDice(string $raw): string
    {
        return MatSerializer::xgDice($raw);
    }

    /** Notasyon XG lehçesine — geriye uyumlu genel API. MatSerializer'a devreder. */
    public static function xgMoves(string $notation): string
    {
        return MatSerializer::xgMoves($notation);
    }

    // -----------------------------------------------------------------------
    // MODEL + RENDER (serileştirme MatSerializer'da)
    // -----------------------------------------------------------------------

    /**
     * Segmente edilmiş oyunları ortak modele çevirip MatSerializer 'xg' ile serileştir.
     *
     * @param  list<list<array>>  $games
     */
    private static function renderModel(array $games, array $opts): string
    {
        $model = [];
        foreach ($games as $rows) {
            $model[] = self::gameModel($rows);
        }

        return MatSerializer::render($model, $opts + ['dialect' => 'xg']);
    }

    /**
     * Bir oyunun turlarını ortak modele (çiftlenmiş acts + outcome) çevirir. Zar/hamle HAM bırakılır
     * (MatSerializer 'xg' lehçesinde dönüştürür). Sonuç 'end' olayından; yoksa küp-drop'tan türetilir.
     *
     * @return array{acts: list<array>, outcome: ?array{winner:string,points:int}}
     */
    private static function gameModel(array $rows): array
    {
        $raw = [];
        $outcome = null;
        foreach ($rows as $t) {
            $kind = $t['k'] ?? null;
            $player = ($t['p'] ?? '') === 'W' ? 'white' : 'black';
            if ($kind === 'end') {
                $pts = 1;
                if (preg_match('/(\d+)\s*p\b/u', (string) ($t['m'] ?? ''), $mm)) {
                    $pts = max(1, (int) $mm[1]);
                }
                $outcome = ['winner' => $player, 'points' => $pts];

                continue;
            }
            if ($kind === 'cube') {
                $raw[] = ['kind' => self::cubeChoice($t), 'player' => $player];

                continue;
            }
            $raw[] = ['kind' => 'move', 'player' => $player, 'dice' => self::parseDice((string) ($t['d'] ?? '')), 'notation' => trim((string) ($t['m'] ?? ''))];
        }

        $acts = MatSerializer::pairCube($raw);

        // Küp pas -> teklifi kabul etmeyen kaybeder; sonuç 'end' yoksa bundan türetilir.
        if (! $outcome) {
            $cube = 1;
            $dropWinner = null;
            foreach ($acts as $a) {
                if ($a['kind'] === 'take') {
                    $cube *= 2;
                } elseif ($a['kind'] === 'drop') {
                    $dropWinner = $a['player'] === 'white' ? 'black' : 'white';
                }
            }
            if ($dropWinner) {
                $outcome = ['winner' => $dropWinner, 'points' => $cube];
            }
        }

        return ['acts' => $acts, 'outcome' => $outcome];
    }

    /** Ham zar metni "6-5" -> [6,5] (int[]). MatSerializer kanonikleştirir. */
    private static function parseDice(string $raw): array
    {
        $digits = preg_replace('/[^1-6]/', '', $raw) ?? '';

        return array_map('intval', str_split($digits));
    }

    // -----------------------------------------------------------------------
    // SEGMENTASYON (kaynağa özgü — `g` YOK SAYILIR)
    // -----------------------------------------------------------------------

    /**
     * İki HAM diziden gerçek oyunlara böl. Her dizi kendi içinde append-sıralı (kronolojik)
     * kabul edilir; oyun indeksi `s`-reset + terminal ile YENİDEN türetilir (stored `g` YOK SAYILIR),
     * iki dizi (rg, s, o) ile birleşip içerikçe tekilleşir.
     *
     * @return list<list<array>>
     */
    private static function segmentGames(array $p1Events, array $p2Events): array
    {
        $tagged = array_merge(
            self::tagByRealGame($p1Events, 0),
            self::tagByRealGame($p2Events, 1),
        );
        if (! $tagged) {
            return [];
        }

        usort($tagged, function ($a, $b) {
            return ($a['_rg'] <=> $b['_rg'])
                ?: (($a['_s'] <=> $b['_s'])
                ?: (($a['_o'] <=> $b['_o'])
                ?: (($a['_src'] <=> $b['_src'])
                ?: ($a['_idx'] <=> $b['_idx']))));
        });

        // İçerik tekilleştirme: aynı gerçek tur İKİ diziye de yazılmış olabilir (her istemci
        // rakibin hamlesini de KENDİ koluna yazar). end oyun başına tekil; küp tek-yazar.
        $seen = [];
        $deduped = [];
        foreach ($tagged as $t) {
            $key = self::dedupKey($t);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $deduped[] = $t;
        }

        $games = [];
        $curRg = null;
        foreach ($deduped as $t) {
            if ($t['_rg'] !== $curRg) {
                $curRg = $t['_rg'];
                $games[] = [];
            }
            $games[count($games) - 1][] = $t;
        }

        self::validate($games);

        return $games;
    }

    /**
     * TEK dizi durum-makinesi bölme (geriye uyumlu build()). Verilen SIRA korunur; yeni oyun bir
     * HAMLE ile başlar: terminal (end/drop) sonrası, `g` değişince veya `s` düşünce (turnsPlayed reset).
     *
     * @return list<list<array>>
     */
    private static function stateMachineSplit(array $turns): array
    {
        $games = [];
        $curG = null;
        $lastSeq = -1;
        $seenMove = false;
        $afterTerminal = false;

        foreach ($turns as $t) {
            $kind = $t['k'] ?? null;
            $isEnd = $kind === 'end';
            $isDrop = $kind === 'cube' && self::cubeChoice($t) === 'drop';
            $isMove = ! $isEnd && $kind !== 'cube';
            $g = (int) ($t['g'] ?? 1);
            $s = (int) ($t['s'] ?? 0);

            // Yeni oyun YALNIZCA bir HAMLE ile başlar (ardışık terminaller — drop + end — AYNI
            // oyuna aittir; end drop'tan sonra gelse bile oyun 1'in sonucudur). Küp asla oyunun
            // ilk eylemi olamaz (önce zar atılır), bu yüzden hamle-kapısı güvenlidir.
            $newGame = false;
            if (empty($games)) {
                $newGame = true;
            } elseif ($isMove && $afterTerminal) {
                $newGame = true;
            } elseif ($isMove && $curG !== null && $g !== $curG) {
                $newGame = true;
            } elseif ($isMove && $seenMove && $s <= 1 && $s < $lastSeq) {
                $newGame = true;
            }

            if ($newGame) {
                $games[] = [];
                $lastSeq = -1;
                $seenMove = false;
            }
            $games[count($games) - 1][] = $t;

            $curG = $g;
            if ($isMove) {
                $lastSeq = $s;
                $seenMove = true;
            }
            $afterTerminal = $isEnd || $isDrop;
        }

        self::validate($games);

        return $games;
    }

    /**
     * Bir dizinin turlarına GERÇEK oyun indeksi (`_rg`) ata. Append sırası kronolojiktir; oyun
     * sınırı `s`-reset (turnsPlayed 0/1'e döner) veya terminal (end/drop) ile bulunur — stored `g`
     * YOK SAYILIR. `_s`/`_o` birleştirme sıralaması için normalize edilir.
     *
     * @return list<array>
     */
    private static function tagByRealGame(array $arr, int $src): array
    {
        $out = [];
        $rg = 0;
        $lastSeq = -1;
        $seenMove = false;
        $afterTerminal = false;

        foreach (array_values($arr) as $idx => $e) {
            $kind = $e['k'] ?? null;
            $isEnd = $kind === 'end';
            $isDrop = $kind === 'cube' && self::cubeChoice($e) === 'drop';
            $isMove = ! $isEnd && $kind !== 'cube';
            $s = (int) ($e['s'] ?? 0);

            // Yeni oyun YALNIZCA bir HAMLE ile başlar: ardışık terminaller (drop + end) AYNI oyunun
            // kapanışıdır -> end, drop'tan sonra gelse bile oyun 1'in rg'sinde kalır.
            if ($isMove && $afterTerminal) {
                $rg++;
                $lastSeq = -1;
                $seenMove = false;
                $afterTerminal = false;
            } elseif ($isMove && $seenMove && $s <= 1 && $s < $lastSeq) {
                $rg++;
                $lastSeq = -1;
                $seenMove = false;
            }

            $e['_rg'] = $rg;
            $e['_s'] = $s;
            // Aynı seq içinde: küp teklif(-3) < küp yanıt(-2) < hamle(0) < bitiş(9).
            $e['_o'] = $isEnd ? 9 : (int) ($e['o'] ?? ($kind === 'cube' ? -2 : 0));
            $e['_src'] = $src;
            $e['_idx'] = $idx;
            $out[] = $e;

            if ($isMove) {
                $lastSeq = $s;
                $seenMove = true;
            }
            if ($isEnd || $isDrop) {
                $afterTerminal = true;
            }
        }

        return $out;
    }

    /**
     * Birleştirmede tekilleştirme anahtarı = TUR KİMLİĞİ (gerçek-oyun + oyuncu + seq + o), İÇERİK
     * DEĞİL. Online'da aynı gerçek turu iki istemci de yazar (own + recon) ve İKİSİ de aynı seq'i
     * okur (recordMatchTurn / applyServerBoard, hamle-ÖNCESİ turnsPlayed) -> aynı (rg,p,s,o) ->
     * tekilleşir. KRİTİK: içerik-tabanlı anahtar (dice+notation), AYNI ZARLI iki FARKLI no-move
     * (dance) turunu -> notation ikisinde de boş -> YANLIŞLIKLA çakıştırıp SİLİYORDU (turn history
     * kaybı, rakip art arda zar atmış görünümü). seq her turda benzersiz olduğundan kimlik-anahtarı
     * bu kaybı önler. (end oyun başına tekil; iki istemci de yazabilir.)
     */
    private static function dedupKey(array $t): string
    {
        $rg = $t['_rg'];
        if (($t['k'] ?? null) === 'end') {
            return "end:$rg"; // oyun başına tek sonuç
        }
        $p = (string) ($t['p'] ?? '');

        return "$rg:$p:".((int) ($t['_s'] ?? 0)).':'.((int) ($t['_o'] ?? 0));
    }

    /** Küp turunun seçimi: take / drop / double (m metni + o'dan). */
    private static function cubeChoice(array $t): string
    {
        if (($t['k'] ?? null) !== 'cube') {
            return '';
        }
        $m = (string) ($t['m'] ?? '');
        if (str_contains($m, 'Kabul')) {
            return 'take';
        }
        if (str_contains($m, 'Pas')) {
            return 'drop';
        }

        return ((int) ($t['o'] ?? 0)) === -2 ? 'take' : 'double';
    }

    /**
     * EXPORT ÖNCESİ DENETİM (assertion). Bozuk segmentasyonu ÜRETMEYE devam etmek yerine LOG'la
     * (indirmeyi bozmamak için exception atmaz; kanıt bırakır). Kural: DROP/END'den sonra AYNI
     * oyunda hamle olmamalı.
     *
     * @param  list<list<array>>  $games
     */
    private static function validate(array $games): void
    {
        $warn = [];
        foreach ($games as $gi => $rows) {
            $terminalAt = null;
            foreach ($rows as $ri => $t) {
                $kind = $t['k'] ?? null;
                $isEnd = $kind === 'end';
                $isDrop = $kind === 'cube' && self::cubeChoice($t) === 'drop';
                $isMove = ! $isEnd && $kind !== 'cube';
                if ($terminalAt !== null && $isMove) {
                    $warn[] = "game $gi: terminal(#$terminalAt) sonrası hamle(#$ri)";
                }
                if ($isEnd || $isDrop) {
                    $terminalAt = $ri;
                }
            }
        }
        if ($warn) {
            Log::warning('MatFromLog segmentasyon uyarısı', ['issues' => $warn]);
        }
    }
}
