<?php

namespace App\Services;

use App\Services\GnuBg\GnuBgClient;

/**
 * gnubg karar üretemediğinde (servis kapalı / boş sonuç) fırlatılır. Çağıran (RoomController)
 * bunu 503'e çevirir: bot maçı "duraklat + net hata" (kullanıcı direktifi) — ZAYIF fallback YOK,
 * gnubg botun TEK karar otoritesidir.
 */
class BotUnavailableException extends \RuntimeException
{
}

/**
 * SUNUCU-OTORİTER BOT hamle seçimi. Bot artık tarayıcıda (ONNX) DEĞİL sunucuda oynar.
 *
 * Akış:
 *  1) TS motoru (validator /legal-moves) yasal tam-tur adaylarını verir — TEK gerçek kaynak.
 *     Erişilemezse bot oynayamaz (BotUnavailable -> çağıran duraklatır).
 *  2) 0 yasal hamle -> dance (boş dizi = pas). 1 yasal hamle -> gnubg'ye gerek yok.
 *  3) >1 aday -> gnubg konumu analiz eder, adayları equity'e göre sıralar (her adayda `steps`).
 *  4) Seviye (1-10) gürültüsü: 10 = daima en iyi; düşük seviye üst-K aday arasından seçer.
 *
 * NOT: seçilen adımlar YİNE validator.validate'ten geçer (RoomController.move gibi) — yani bot
 * bile "istemci" gibi doğrulanır; yasadışı bir şey uygulanamaz.
 */
class BotMoveService
{
    public function __construct(
        private GnuBgClient $gnubg,
        private MoveValidatorService $validator,
    ) {}

    /**
     * Botun ($state['turn']) SIRASI için oynanacak tam-tur adımlarını seç.
     *
     * @param  array  $state  authoritative server_state (zar DOLU)
     * @param  array  $sm     server_match (target/score/cube)
     * @param  int    $level  bot zorluk 1-10
     * @return array  Step[]  (boş dizi = pas / dance)
     *
     * @throws BotUnavailableException gnubg/validator karar üretemezse (duraklat)
     */
    public function chooseSteps(array $state, array $sm, int $level): array
    {
        // 1) Yasal tam-tur adayları (TS motoru = tek gerçek). Bunlar DOĞRU `die`'li adımlar taşır.
        $legal = $this->validator->legalMoves($state);
        if ($legal === null) {
            throw new BotUnavailableException('validator-unreachable');
        }
        $legal = array_values(array_filter($legal, 'is_array'));
        if (count($legal) === 0) {
            return []; // dance / oynanacak hamle yok -> pas
        }
        if (count($legal) === 1) {
            return $this->stepsOf($legal[0]); // tek seçenek -> gnubg gereksiz
        }

        // Yasal hamleleri SONUÇ-TAHTASI imzasıyla indexle (die'nin OTORİTER kaynağı: validator).
        // NEDEN from/to DEĞİL: gnubg birleşik tek-taş hamlesini KOMPAKT yazar ("24/13" = tek adım),
        // motor ise HER zarı ayrı adım üretir ("24/18 18/13" = iki adım) -> from/to anahtarları
        // ASLA eşleşmez. Aynı hamlenin SONUÇ TAHTASI ikisinde de AYNIDIR -> güvenilir eşleşme.
        // (KÖK NEDEN "seviye 10 bot ~32 PR": en iyi hamle birleşik tek-taş oynayış [koşu/race/
        //  toplama/çiftler] olduğunda gnubg #1 sessizce elenip bot daha KÖTÜ ama eşleşen hamleyi
        //  oynuyordu; ranked boş kalmadığı için fallback logu da YAZILMIYORDU -> teşhis edilemiyordu.)
        $byBoard = [];
        foreach ($legal as $m) {
            $steps = $this->stepsOf($m);
            $byBoard[$this->boardAfter($state, $steps)] = $steps;
        }

        // 2) gnubg konumu analiz eder, adayları equity-azalan sıralar. Her adayda notasyondan
        //    türetilmiş `steps` (from/to; die=0) bulunur (python /analyze eki).
        $analysis = $this->gnubg->analyze($this->positionFor($state, $sm, $level));
        $cands = is_array($analysis) ? ($analysis['result']['hint'] ?? null) : null;
        if (! is_array($cands) || count($cands) === 0) {
            // gnubg yok/boş -> KARAR YOK. Direktif: gnubg tek otorite -> duraklat (zayıf fallback YOK).
            throw new BotUnavailableException('gnubg-unavailable');
        }

        // 3) gnubg sırasını yasal hamlelere SONUÇ-TAHTASI ile EŞLE (die'yi validator'dan al) -> sıralı.
        $ranked = [];
        foreach ($cands as $c) {
            $cs = $this->stepsOf($c);
            if (count($cs) === 0) {
                continue; // notasyonu parse edilememiş aday -> atla
            }
            $key = $this->boardAfter($state, $cs);
            if (isset($byBoard[$key])) {
                $ranked[] = $byBoard[$key];
                unset($byBoard[$key]); // aynı sonuç-tahtasını iki kez ekleme (equity-en-iyi olan kalır)
            }
        }

        $fallbackUsed = false;
        if (count($ranked) === 0) {
            // gnubg adayları yasal hamlelere sonuç-tahtası ile EŞLENEMEDİ (nadir: notasyon parse
            // edge-case'i). GÜVENLİ ÇÖZÜM (kullanıcı direktifi): ASLA körlemesine ilk yasalı oynama.
            // Son çare -> her YASAL hamleyi gnubg ile skorla, EN İYİ yasalı seç (hâlâ gnubg-otoriter).
            // O da başarısızsa -> BotUnavailable (maç duraklar; çağıran 503 + retry). legal[0] KALDIRILDI.
            $best = $this->bestLegalByGnubg($state, $sm, $level, $legal);
            \Illuminate\Support\Facades\Log::warning('bot.gnubg-no-match', [
                'legal' => count($legal),
                'cands' => count($cands),
                'turn' => $state['turn'] ?? '?',
                'dice' => array_slice(array_values(array_filter(array_map('intval', $state['dice'] ?? []))), 0, 2),
                'recovered' => $best !== null,
            ]);
            if ($best === null) {
                throw new BotUnavailableException('gnubg-no-legal-match');
            }

            return $best; // en iyi yasal (gnubg skorlu) — körlemesine değil
        }

        // 4) Seviye gürültüsü ile sıralı yasal hamleler arasından seç.
        $idx = $this->pickIndexByLevel(count($ranked), $level);

        // Teşhis/izleme (Level 11/12 concurrency + escalation gözlemi için).
        $diag = is_array($analysis) ? ($analysis['diag'] ?? []) : [];
        \Illuminate\Support\Facades\Log::info('bot.gnubg', [
            'gnubg_level' => $level,
            'gnubg_ply' => $diag['plies_used'] ?? null,
            'gnubg_cube_ply' => $this->levelEval($level)['cubePlies'],
            'gnubg_response_ms' => $diag['response_ms'] ?? null,
            'gnubg_top_gap' => $diag['top_gap'] ?? null,
            'gnubg_escalated_to_4ply' => $diag['escalated'] ?? false,
            'gnubg_selected_equity' => $cands[0]['equity'] ?? null,
            'gnubg_selected_index' => $idx,
            'gnubg_fallback_used' => $fallbackUsed,
        ]);

        return $ranked[$idx];
    }

    /**
     * legal[0] fallback'in GÜVENLİ yerine geçeni: her yasal tam-tur hamlesini gnubg ile skorla,
     * en iyi equity'liyi seç. Konum eşleşmesi başarısız olduğunda (nadir) körlemesine ilk yasalı
     * oynamak yerine gnubg-otoriter bir seçim yapar. Skorlanamazsa null (çağıran -> BotUnavailable).
     *
     * Yaklaşım: her yasal hamlenin SONUÇ pozisyonunu (rakip sırada) gnubg /analyze ile değerlendir;
     * rakip için en DÜŞÜK equity = bizim için en iyi hamle (sıfır-toplam). Zar yoksa (imkânsız burada)
     * atlanır. N genelde < 20 -> sınırlı sayıda hızlı analiz.
     */
    private function bestLegalByGnubg(array $state, array $sm, int $level, array $legal): ?array
    {
        $turn = ($state['turn'] ?? 'white') === 'black' ? 'black' : 'white';
        $opp = $turn === 'white' ? 'black' : 'white';
        $bestSteps = null;
        $bestOppEq = null; // rakip için en düşük equity'yi ara (bizim için en iyi)
        foreach ($legal as $m) {
            $steps = $this->stepsOf($m);
            if (count($steps) === 0) {
                continue;
            }
            $after = $this->applyStepsToState($state, $steps);
            $after['turn'] = $opp;      // hamleden sonra rakip sırada
            $after['dice'] = [];        // zarsız -> pozisyon değerlendirmesi (cube result + evaluate)
            $res = $this->gnubg->analyze($this->cubePositionFor($after, $sm, $level));
            $eq = $this->equityFromEvaluate($res);
            if ($eq === null) {
                continue;
            }
            if ($bestOppEq === null || $eq < $bestOppEq) {
                $bestOppEq = $eq;
                $bestSteps = $steps;
            }
        }

        return $bestSteps;
    }

    /** gnubg /analyze (zarsız) sonucundan rakip-perspektifi cubeless equity türet (evaluate probs). */
    private function equityFromEvaluate(mixed $res): ?float
    {
        if (! is_array($res)) {
            return null;
        }
        $ev = $res['evaluate'] ?? null;
        // gnubg.evaluate() -> [win, winG, winBG, loseG, loseBG] (kümülatif). cubeless money equity:
        //   eq = 2*win - 1 + (winG - loseG) + (winBG - loseBG). Sıralama için yeterli (mutlak değer değil).
        if (is_array($ev) && count($ev) >= 5) {
            $win = (float) $ev[0];
            $wg = (float) $ev[1];
            $wbg = (float) $ev[2];
            $lg = (float) $ev[3];
            $lbg = (float) $ev[4];

            return 2.0 * $win - 1.0 + ($wg - $lg) + ($wbg - $lbg);
        }

        return null;
    }

    /** Step[]'i state'e uygula -> yeni state (points/bar/off). boardAfter ile aynı mantık, tam state döner. */
    private function applyStepsToState(array $state, array $steps): array
    {
        $pts = array_map('intval', array_values($state['points'] ?? []));
        $bar = [
            'white' => (int) ($state['bar']['white'] ?? 0),
            'black' => (int) ($state['bar']['black'] ?? 0),
        ];
        $off = [
            'white' => (int) ($state['off']['white'] ?? 0),
            'black' => (int) ($state['off']['black'] ?? 0),
        ];
        $turn = ($state['turn'] ?? 'white') === 'black' ? 'black' : 'white';
        $opp = $turn === 'white' ? 'black' : 'white';
        $sign = $turn === 'white' ? 1 : -1;
        foreach ($steps as $s) {
            if (! is_array($s)) {
                continue;
            }
            $from = $s['from'] ?? null;
            $to = $s['to'] ?? null;
            if ($from === 'bar') {
                $bar[$turn]--;
            } elseif (is_numeric($from)) {
                $pts[(int) $from] -= $sign;
            }
            if ($to === 'off') {
                $off[$turn]++;
            } elseif (is_numeric($to)) {
                $t = (int) $to;
                if (($pts[$t] ?? 0) === -$sign) {
                    $pts[$t] = 0;
                    $bar[$opp]++;
                }
                $pts[$t] = ($pts[$t] ?? 0) + $sign;
            }
        }

        return ['points' => $pts, 'bar' => $bar, 'off' => $off, 'turn' => $turn];
    }

    /**
     * KÜP kararı gnubg'den. mode='offer' -> 'double'|'no-double' (bot sırasında katlasın mı);
     * mode='respond' -> 'take'|'drop' (insan katladı, bot ne yapsın). gnubg (zar YOK -> küp analizi)
     * 'proper' önerisini kullanır; yoksa equity fallback. gnubg erişilemezse GÜVENLİ varsayılan
     * (respond->take: asla takılmaz/puan hediye etmez; offer->no-double: gereksiz katlamaz).
     */
    public function chooseCube(array $state, array $sm, string $mode, int $level = 10): string
    {
        $fallback = $mode === 'respond' ? 'take' : 'no-double';
        try {
            $res = $this->gnubg->analyze($this->cubePositionFor($state, $sm, $level));
        } catch (\Throwable $e) {
            return $fallback;
        }
        $cube = is_array($res) ? ($res['cube'] ?? null) : null;
        $proper = is_array($cube) ? strtolower(trim((string) ($cube['proper'] ?? ''))) : '';

        if ($proper !== '') {
            if ($mode === 'respond') {
                // 'proper' yanıtlayan aksiyonunu da içerir: "...pass" -> drop, "...take" -> take.
                return str_contains($proper, 'pass') ? 'drop' : 'take';
            }
            // offer: "double"/"redouble" (ama "no ..." ve "too good" HARİÇ) -> katla.
            $isDouble = (str_contains($proper, 'double') || str_contains($proper, 'redouble'))
                && ! str_contains($proper, 'no ')
                && ! str_contains($proper, 'too good');

            return $isDouble ? 'double' : 'no-double';
        }

        // 'proper' yoksa equity'den karar (AnalysisOrchestrator ile aynı perspektif).
        $eq = is_array($cube) ? ($cube['equities'] ?? null) : null;
        if (is_array($eq) && isset($eq['noDouble'], $eq['doubleTake'], $eq['doublePass'])) {
            return $this->cubeFromEquities($mode, (float) $eq['noDouble'], (float) $eq['doubleTake'], (float) $eq['doublePass']);
        }

        return $fallback; // gnubg boş -> güvenli
    }

    /** Equity fallback: respond -> take (dT<=1); offer -> double (min(dT,dP) >= noD). */
    private function cubeFromEquities(string $mode, float $noDouble, float $doubleTake, float $doublePass): string
    {
        if ($mode === 'respond') {
            // Yanıtlayan perspektifi: take = -doubleTake, pass = -1 (küp değeri). take >= pass?
            return (-$doubleTake) >= -1.0 ? 'take' : 'drop';
        }
        $doubleVal = min($doubleTake, $doublePass); // rakip optimal yanıt (doubler için en kötü)

        return $doubleVal >= $noDouble ? 'double' : 'no-double';
    }

    /** Küp kararı için konum: ZAR YOK -> gnubg /analyze küp analizi (cube result) döndürür. */
    private function cubePositionFor(array $state, array $sm, int $level = 10): array
    {
        return $this->applyEval([
            'points' => array_map('intval', $state['points'] ?? []),
            // bar'ı gönder (positionFor ile aynı gerekçe): eksikse gnubg yanlış pozisyon analiz eder.
            'bar' => [
                'white' => (int) ($state['bar']['white'] ?? 0),
                'black' => (int) ($state['bar']['black'] ?? 0),
            ],
            'turn' => $state['turn'] ?? 'white',
            'dice' => [], // zar yok -> küp kararı
            'matchLength' => (int) ($sm['target'] ?? 1),
            'crawford' => (bool) ($sm['crawford'] ?? false),
            'score' => [
                'white' => (int) ($sm['score']['white'] ?? 0),
                'black' => (int) ($sm['score']['black'] ?? 0),
            ],
            'cube' => [
                'value' => (int) ($sm['cube']['value'] ?? 1),
                'owner' => $sm['cube']['owner'] ?? null,
            ],
        ], $level);
    }

    /** Aday nesnesinden (validator {steps,resultKey} | gnubg {move,steps}) adımları çıkar. */
    private function stepsOf(array $cand): array
    {
        $steps = $cand['steps'] ?? [];

        return is_array($steps) ? array_values($steps) : [];
    }

    /**
     * Adımları $state'e uygulayıp SONUÇ TAHTASININ imzasını döndürür — iki motor arası hamle eşleme
     * anahtarı. from/to notasyonu yerine sonuç tahtasını kullanmak birleşik tek-taş hamlelerini
     * (gnubg "24/13" tek-adım vs motor "24/18 18/13" iki-adım) DOĞRU eşler; python _apply_our_steps
     * ile aynı mantık (vuruş dahil). die alanı önemsiz. Vuruşlu birleşik hamlede gnubg ara noktayı
     * '*' ile gösterir -> parse çok-adımlı gelir -> ara vuruş da yakalanır (sonuç yine birebir).
     */
    private function boardAfter(array $state, array $steps): string
    {
        $pts = array_map('intval', array_values($state['points'] ?? []));
        $bar = [
            'white' => (int) ($state['bar']['white'] ?? 0),
            'black' => (int) ($state['bar']['black'] ?? 0),
        ];
        $off = [
            'white' => (int) ($state['off']['white'] ?? 0),
            'black' => (int) ($state['off']['black'] ?? 0),
        ];
        $turn = ($state['turn'] ?? 'white') === 'black' ? 'black' : 'white';
        $opp = $turn === 'white' ? 'black' : 'white';
        $sign = $turn === 'white' ? 1 : -1;

        foreach ($steps as $s) {
            if (! is_array($s)) {
                continue;
            }
            $from = $s['from'] ?? null;
            $to = $s['to'] ?? null;
            if ($from === 'bar') {
                $bar[$turn]--;
            } elseif (is_numeric($from)) {
                $pts[(int) $from] -= $sign;
            }
            if ($to === 'off') {
                $off[$turn]++;
            } elseif (is_numeric($to)) {
                $t = (int) $to;
                if (($pts[$t] ?? 0) === -$sign) { // tek rakip blot -> vur (bara gönder)
                    $pts[$t] = 0;
                    $bar[$opp]++;
                }
                $pts[$t] = ($pts[$t] ?? 0) + $sign;
            }
        }

        return implode(',', $pts).'|'.$bar['white'].','.$bar['black'].'|'.$off['white'].','.$off['black'];
    }

    /**
     * Seviyeye göre aday indeksi. 10 = daima en iyi (0). Seviye düştükçe "blunder" olasılığı ve
     * seçim havuzu genişler (insan-benzeri hata). gnubg adayları equity-azalan sıralı gelir.
     */
    private function pickIndexByLevel(int $n, int $level): int
    {
        $level = max(1, min(10, $level));
        if ($level >= 10 || $n <= 1) {
            return 0;
        }
        // Blunder olasılığı: level 9 ~%8, level 1 ~%75.
        $blunder = (10 - $level) / 12.0;
        if (random_int(1, 1000) / 1000.0 > $blunder) {
            return 0; // en iyiyi oyna
        }
        // En iyi hariç, seviye düştükçe genişleyen üst havuzdan seç.
        $k = min($n - 1, 1 + intdiv(10 - $level, 2));

        return random_int(1, $k);
    }

    /**
     * SEVİYE -> gnubg eval konfigürasyonu (TEK KAYNAK). 1-10: mevcut güçlü/hızlı bot (2-ply,
     * cube 2-ply, Normal filtre) — DEĞİŞMEDİ. 11 (Grandmaster): 3-ply + cube 3-ply + geniş filtre.
     * 12 (Ultimate): 3-ply taban + kritik pozisyonda 4-ply'a ADAPTIVE yükseliş + geniş filtre.
     *
     * NOT: 1-9 seviyelerinin İNSAN-BENZERİ hatası pickIndexByLevel'de; buradaki eval (motor gücü)
     * 1-10 için AYNI kalır -> yalnız aday SEÇİMİ seviyeyle bozulur (mevcut davranış korunur).
     */
    private function levelEval(int $level): array
    {
        $deepFilter = (string) config('gnubg.deep_movefilter', 'large');
        if ($level >= 12) {
            return [
                'chequerPlies' => 3,
                'cubePlies' => 3,
                'movefilter' => $deepFilter,
                'adaptive' => true,
                'escalatePlies' => (int) config('gnubg.level12_escalate_plies', 4),
                'topGap' => (float) config('gnubg.level12_4ply_threshold', 0.040),
                'maxSeconds' => (float) config('gnubg.level12_max_seconds', 10),
            ];
        }
        if ($level === 11) {
            return [
                'chequerPlies' => 3,
                'cubePlies' => 3,
                'movefilter' => $deepFilter,
                'adaptive' => false,
            ];
        }

        // 1-10: mevcut davranış (2-ply). cube ply artık AÇIKÇA 2 (eskiden set edilmiyordu -> A hatası).
        return [
            'chequerPlies' => 2,
            'cubePlies' => 2,
            'movefilter' => 'normal',
            'adaptive' => false,
        ];
    }

    /** eval konfigürasyonunu gnubg /analyze konum sözlüğüne uygula (self-contained request). */
    private function applyEval(array $pos, int $level): array
    {
        $e = $this->levelEval($level);
        $pos['plies'] = $e['chequerPlies'];
        $pos['cubePlies'] = $e['cubePlies'];
        $pos['movefilter'] = $e['movefilter'];
        if ($e['adaptive']) {
            $pos['adaptive'] = true;
            $pos['escalatePlies'] = $e['escalatePlies'];
            $pos['topGap'] = $e['topGap'];
            $pos['maxSeconds'] = $e['maxSeconds'];
        }

        return $pos;
    }

    /** server_state + server_match -> gnubg /analyze konum sözlüğü. */
    private function positionFor(array $state, array $sm, int $level = 10): array
    {
        $dice = array_values(array_filter(array_map('intval', $state['dice'] ?? [])));

        return $this->applyEval([
            'points' => array_map('intval', $state['points'] ?? []),
            // KRİTİK: bar'ı GÖNDER. Eksikse gnubg botun bardaki taşını GÖRMEZ (hatta 15-toplam'dan
            // hayalet bir "toplanmış" taş sanır) -> YANLIŞ pozisyon analiz eder -> önerdiği adaylar
            // bar-girişi İÇERMEZ -> gerçek yasal hamlelere (hepsi bar-girişi) eşleşmez.
            'bar' => [
                'white' => (int) ($state['bar']['white'] ?? 0),
                'black' => (int) ($state['bar']['black'] ?? 0),
            ],
            'turn' => $state['turn'] ?? 'white',
            // gnubg 2 zar bekler; çift [d,d,d,d] -> [d,d].
            'dice' => array_slice($dice, 0, 2),
            'matchLength' => (int) ($sm['target'] ?? 1),
            // CRAWFORD: server_match'ten gnubg'ye İLET (eskiden hiç gönderilmiyordu -> encoder
            // crawford=0 yazıyordu -> Crawford oyununda yanlış MET/küp bağlamı). Bkz structured_to_gnubgid.
            'crawford' => (bool) ($sm['crawford'] ?? false),
            'score' => [
                'white' => (int) ($sm['score']['white'] ?? 0),
                'black' => (int) ($sm['score']['black'] ?? 0),
            ],
            'cube' => [
                'value' => (int) ($sm['cube']['value'] ?? 1),
                'owner' => $sm['cube']['owner'] ?? null,
            ],
        ], $level);
    }
}
