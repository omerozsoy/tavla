<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * game_logs KOMPAKT tur kaydından ( {g,s,p,d,m,o,k} ) XG-uyumlu .mat metni üretir.
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
 *
 * Çıktı src/matExport.ts buildMatXg ile aynı XG lehçesini kullanır: `; [Site ...]` başlığı,
 * `bar->25`, `off->0`, tekrarlar açık (parantez yok), oyun sonu numaralı iki-sütun
 * "Losses/Wins X point" satırı, maç bitince "and the match". gnubg NATIVE .mat DEĞİLDİR
 * (gnubg'ye verme); bu XG (Extreme Gammon) içindir.
 */
class MatFromLog
{
    private const COLW = 28; // buildMatXg ile birebir (sol aksiyon 28'e padlenir -> sağ sütun col 33)

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
        return self::renderGames(self::segmentGames($p1Events, $p2Events), $opts);
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
        return self::renderGames(self::stateMachineSplit($turns), $opts);
    }

    // -----------------------------------------------------------------------
    // SEGMENTASYON
    // -----------------------------------------------------------------------

    /**
     * İki HAM diziden gerçek oyunlara böl. Her dizi kendi içinde append-sıralı (kronolojik)
     * kabul edilir; oyun indeksi `s`-reset + terminal ile YENİDEN türetilir (stored `g` YOK SAYILIR),
     * iki dizi (rg, s, o) ile birleşip içerikçe tekilleşir.
     *
     * @return list<list<array>>  oyun-başına tur listesi (oyun sırasıyla)
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

        // (rg, s, o) sırala; eşitlikte kaynak sırası (istikrarlı).
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

        // rg -> ardışık oyunlara böl (rg zaten segment sırasını verir; terminal sonrası artık
        // aynı rg'de olamaz çünkü tag terminal'de rg'yi artırdı).
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
     * TEK dizi durum-makinesi bölme (geriye uyumlu build()). Verilen SIRA korunur; yeni oyun:
     * (1) terminal (end / küp drop) sonrası, (2) `g` değişince, (3) `s` düşünce (turnsPlayed reset).
     *
     * @return list<list<array>>
     */
    private static function stateMachineSplit(array $turns): array
    {
        $games = [];
        $curG = null;      // stored g
        $lastSeq = -1;     // bu oyundaki son HAMLE seq'i
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
     * YOK SAYILIR. Küp/end turları da içinde bulundukları gerçek oyunun rg'sini alır. `_s`/`_o`
     * birleştirme sıralaması için normalize edilir.
     *
     * @return list<array>  girdiler + {_rg,_s,_o,_src,_idx}
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

    /** Birleştirmede tekilleştirme anahtarı (gerçek-oyun bazlı; seq'e GÜVENMEZ — off-by-one recon'a dayanıklı). */
    private static function dedupKey(array $t): string
    {
        $rg = $t['_rg'];
        $kind = $t['k'] ?? null;
        if ($kind === 'end') {
            return "end:$rg"; // oyun başına tek sonuç
        }
        $p = (string) ($t['p'] ?? '');
        if ($kind === 'cube') {
            return "cube:$rg:$p:".self::cubeChoice($t);
        }
        // hamle: renk + kanonik zar + notasyon (seq HARİÇ)
        return "mv:$rg:$p:".self::xgDice((string) ($t['d'] ?? '')).':'.trim((string) ($t['m'] ?? ''));
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
     * (indirmeyi bozmamak için exception atmaz; kanıt bırakır). Kurallar sınıf başında listelenen
     * state-machine'in korumalarıyla örtüşür.
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
                // (1) DROP/END'den sonra AYNI oyunda hamle olmamalı.
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

    // -----------------------------------------------------------------------
    // SERİLEŞTİRME (oyun listesi -> .mat metni)
    // -----------------------------------------------------------------------

    /**
     * @param  list<list<array>>  $games  segmente edilmiş oyunlar (tur listeleri)
     * @param  array{whiteName?:string,blackName?:string,matchLength?:int,site?:string,matchId?:string,eventDate?:string,eventTime?:string,crawford?:bool}  $opts
     */
    private static function renderGames(array $games, array $opts): string
    {
        $whiteName = $opts['whiteName'] ?? 'Player1';
        $blackName = $opts['blackName'] ?? 'Player2';
        $matchLength = max(1, (int) ($opts['matchLength'] ?? 1));
        $site = $opts['site'] ?? 'TavlaTV';
        $matchId = $opts['matchId'] ?? '0';
        $eventDate = $opts['eventDate'] ?? '';
        $eventTime = $opts['eventTime'] ?? '';
        $crawford = ($opts['crawford'] ?? true) ? 'On' : 'Off';
        $COLW = self::COLW;

        $out = [
            "; [Site \"$site\"]",
            "; [Match ID \"$matchId\"]",
            "; [Player 1 \"$whiteName\"]",
            "; [Player 2 \"$blackName\"]",
            '; [Player 1 Elo "0"]',
            '; [Player 2 Elo "0"]',
            "; [EventDate \"$eventDate\"]",
            "; [EventTime \"$eventTime\"]",
            '; [Variation "Backgammon"]',
            '; [Unrated "Off"]',
            "; [Crawford \"$crawford\"]",
            '; [CubeLimit "1024"]',
            '',
            "$matchLength point match",
        ];

        $sw = 0;
        $sb = 0;
        $gi = 0;
        foreach ($games as $rows) {
            $gi++;
            $out[] = '';
            $out[] = " Game $gi";
            $out[] = ' '.str_pad("$whiteName : $sw", $COLW + 4)."$blackName : $sb";

            [$acts, $outcome] = self::actsAndOutcome($rows);

            $lines = [];
            $cube = 1;
            foreach ($acts as $a) {
                if ($a['kind'] === 'move') {
                    $d = $a['dice'];
                    $mv = $a['moves'];
                    $text = $mv !== '' ? "$d: $mv" : "$d:";
                } elseif ($a['kind'] === 'double') {
                    $text = 'Doubles => '.($cube * 2);
                } elseif ($a['kind'] === 'take') {
                    $cube *= 2;
                    $text = 'Takes';
                } else {
                    $text = 'Drops';
                }
                $special = $a['kind'] !== 'move';
                if ($a['player'] === 'white') {
                    // Referans XG: sol sütun hamle-dışı girdi bir boşluk girintili.
                    $lines[] = ['w' => $special ? " $text" : $text];
                } else {
                    $li = count($lines) - 1;
                    if ($li >= 0 && array_key_exists('w', $lines[$li]) && ! array_key_exists('b', $lines[$li])) {
                        $lines[$li]['b'] = $text;
                    } else {
                        $lines[] = ['b' => $text];
                    }
                }
            }
            foreach ($lines as $idx => $r) {
                $left = str_pad($r['w'] ?? '', $COLW);
                $out[] = rtrim(sprintf('%3d) %s%s', $idx + 1, $left, $r['b'] ?? ''));
            }

            if ($outcome) {
                $pts = $outcome['points'];
                if ($outcome['winner'] === 'white') {
                    $sw += $pts;
                } else {
                    $sb += $pts;
                }
                $matchOver = ($outcome['winner'] === 'white' ? $sw : $sb) >= $matchLength;
                $winTxt = "Wins $pts point".($matchOver ? ' and the match' : '');
                if ($outcome['winner'] === 'black') {
                    $loseTxt = "Losses $pts point";
                    $num = count($lines) + 1;
                    $out[] = rtrim(sprintf('%3d) %s%s', $num, str_pad(" $loseTxt", $COLW), $winTxt));
                } else {
                    $out[] = "      $winTxt";
                }
            }
        }

        return implode("\n", $out)."\n";
    }

    /**
     * Kompakt turları normalleştirilmiş eylem dizisine ve oyun sonucuna çevirir.
     * Küp satırları çiftlenir (her "Doubles"tan sonra rakibin "Takes"/"Drops" yanıtı);
     * eksik yanıt oyunun akışından üretilir (buildMatXg.actsOf ile aynı mantık).
     *
     * @return array{0: list<array>, 1: array{winner:string,points:int}|null}
     */
    private static function actsAndOutcome(array $rows): array
    {
        $raw = [];
        $outcome = null;
        foreach ($rows as $t) {
            $kind = $t['k'] ?? null;
            $player = ($t['p'] ?? '') === 'W' ? 'white' : 'black';
            if ($kind === 'end') {
                // Kazanan p alanında (ge.winner); puan m sonundaki "Np" değeri.
                $pts = 1;
                if (preg_match('/(\d+)\s*p\b/u', (string) ($t['m'] ?? ''), $mm)) {
                    $pts = max(1, (int) $mm[1]);
                }
                $outcome = ['winner' => $player, 'points' => $pts];

                continue;
            }
            if ($kind === 'cube') {
                $chosen = self::cubeChoice($t);
                $raw[] = ['kind' => $chosen, 'player' => $player];

                continue;
            }
            // Hamle turu: zar "6-5" -> KANONİK "65" (yüksek zar önce); notasyon XG lehçesine.
            $dice = self::xgDice((string) ($t['d'] ?? ''));
            $note = trim((string) ($t['m'] ?? ''));
            $moves = ($note !== '' && $note !== 'pas' && $note !== 'pass') ? self::xgMoves($note) : '';
            $raw[] = ['kind' => 'move', 'player' => $player, 'dice' => $dice, 'moves' => $moves];
        }

        // Küp teklif/yanıt çiftleme (buildMatXg.actsOf portu).
        $out = [];
        $pending = null;
        $opp = fn (string $p) => $p === 'white' ? 'black' : 'white';
        $answer = function (string $kind) use (&$out, &$pending, $opp) {
            if (! $pending) {
                return;
            }
            $out[] = ['kind' => $kind, 'player' => $opp($pending['player'])];
            $pending = null;
        };
        foreach ($raw as $a) {
            if ($a['kind'] === 'double') {
                $answer('take');
                $out[] = $a;
                $pending = $a;

                continue;
            }
            if ($a['kind'] === 'take' || $a['kind'] === 'drop') {
                if (! $pending || $pending['player'] !== $opp($a['player'])) {
                    $out[] = ['kind' => 'double', 'player' => $opp($a['player'])];
                }
                $pending = null;
                $out[] = $a;

                continue;
            }
            $answer('take');
            $out[] = $a;
        }
        $answer('drop');

        // Küp pas -> teklifi kabul etmeyen kaybeder; sonuç 'end' yoksa bundan türetilir.
        if (! $outcome) {
            $cube = 1;
            $dropWinner = null;
            foreach ($out as $a) {
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

        return [$out, $outcome];
    }

    /**
     * KANONİK ZAR NORMALİZASYONU (src/matExport.ts xgDice portu): "6-5"/"56" -> DAİMA yüksek
     * zar önce ("65"). Aynı atış her zaman aynı yazılır -> kaynaktan bağımsız deterministik.
     * SADECE görüntü sırası; hamle token'ları yeniden sıralanmaz. 3+ haneli (dance "6-6-6-6")
     * girdilerde ilk iki zar alınır (buildMatXg ile birebir: dice[0..1]).
     */
    public static function xgDice(string $raw): string
    {
        $digits = preg_replace('/[^1-6]/', '', $raw) ?? '';
        if (strlen($digits) < 2) {
            return $digits;
        }
        $a = (int) $digits[0];
        $b = (int) $digits[1];

        return $a >= $b ? "$a$b" : "$b$a";
    }

    /** Notasyonu XG lehçesine çevir + tekrarları aç (src/matExport.ts xgMoves portu). */
    public static function xgMoves(string $notation): string
    {
        $tokens = preg_split('/\s+/', trim($notation), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $out = [];
        foreach ($tokens as $tok) {
            foreach (self::xgToken($tok) as $t) {
                $out[] = $t;
            }
        }

        return implode(' ', $out);
    }

    /** Tek token: "bar/20"->["25/20"], "8/3(2)"->["8/3","8/3"], "6/off"->["6/0"]; vuruş (*) korunur. */
    private static function xgToken(string $tok): array
    {
        if (! preg_match('/^(.+?)(?:\((\d+)\))?$/', $tok, $m)) {
            return [$tok];
        }
        $path = $m[1];
        $n = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 1;
        $conv = implode('/', array_map(function ($seg) {
            $star = str_ends_with($seg, '*') ? '*' : '';
            $core = $star ? substr($seg, 0, -1) : $seg;
            $mapped = $core === 'bar' ? '25' : ($core === 'off' ? '0' : $core);

            return $mapped.$star;
        }, explode('/', $path)));

        return array_fill(0, max(1, $n), $conv);
    }
}
