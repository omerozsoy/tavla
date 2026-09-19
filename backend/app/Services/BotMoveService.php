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

        // Yasal hamleleri from/to imzasıyla indexle (die'nin OTORİTER kaynağı: validator).
        $byKey = [];
        foreach ($legal as $m) {
            $steps = $this->stepsOf($m);
            $byKey[$this->fromToKey($steps)] = $steps;
        }

        // 2) gnubg konumu analiz eder, adayları equity-azalan sıralar. Her adayda notasyondan
        //    türetilmiş `steps` (from/to; die=0) bulunur (python /analyze eki).
        $analysis = $this->gnubg->analyze($this->positionFor($state, $sm));
        $cands = is_array($analysis) ? ($analysis['result']['hint'] ?? null) : null;
        if (! is_array($cands) || count($cands) === 0) {
            // gnubg yok/boş -> KARAR YOK. Direktif: gnubg tek otorite -> duraklat (zayıf fallback YOK).
            throw new BotUnavailableException('gnubg-unavailable');
        }

        // 3) gnubg sırasını yasal hamlelere from/to ile EŞLE (die'yi validator'dan al) -> sıralı liste.
        $ranked = [];
        foreach ($cands as $c) {
            $key = $this->fromToKey($this->stepsOf($c));
            if ($key !== '' && isset($byKey[$key])) {
                $ranked[] = $byKey[$key];
            }
        }
        if (count($ranked) === 0) {
            // KÖK FIX (bot bar'da TAKILMASI): gnubg adayları yasal hamlelere from/to ile EŞLENEMEDİ
            // (ör. bar-giriş "bar/X" notasyonu validator'ın sayısal nokta temsiliyle uyuşmuyor).
            // ESKİDEN throw -> BotUnavailableException -> bot bar'da bekleyip KALIYORDU (validator +
            // gnubg YEŞİL olsa bile "bot oynamıyor" bug'ı buydu). gnubg AYAKTA ve YASAL hamle VAR ->
            // bot ASLA takılmamalı: gnubg sıralamasını eşleyemediğimiz nadir durumda YASAL bir hamle
            // oyna (ilk yasal). Gösterilen PR ayrı gnubg-authoritative yolla hesaplanır (bu bozmaz).
            // (gnubg gerçekten DÜŞÜKSE yukarıda gnubg-unavailable ile duraklar/retry eder — o korunur.)
            \Illuminate\Support\Facades\Log::warning('bot.gnubg-no-match-fallback', [
                'legal' => count($legal),
                'cands' => count($cands),
                'turn' => $state['turn'] ?? '?',
                'dice' => array_slice(array_values(array_filter(array_map('intval', $state['dice'] ?? []))), 0, 2),
            ]);

            return $this->stepsOf($legal[0]);
        }

        // 4) Seviye gürültüsü ile sıralı yasal hamleler arasından seç.
        $idx = $this->pickIndexByLevel(count($ranked), $level);

        return $ranked[$idx];
    }

    /**
     * KÜP kararı gnubg'den. mode='offer' -> 'double'|'no-double' (bot sırasında katlasın mı);
     * mode='respond' -> 'take'|'drop' (insan katladı, bot ne yapsın). gnubg (zar YOK -> küp analizi)
     * 'proper' önerisini kullanır; yoksa equity fallback. gnubg erişilemezse GÜVENLİ varsayılan
     * (respond->take: asla takılmaz/puan hediye etmez; offer->no-double: gereksiz katlamaz).
     */
    public function chooseCube(array $state, array $sm, string $mode): string
    {
        $fallback = $mode === 'respond' ? 'take' : 'no-double';
        try {
            $res = $this->gnubg->analyze($this->cubePositionFor($state, $sm));
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
    private function cubePositionFor(array $state, array $sm): array
    {
        return [
            'points' => array_map('intval', $state['points'] ?? []),
            'turn' => $state['turn'] ?? 'white',
            'dice' => [], // zar yok -> küp kararı
            'matchLength' => (int) ($sm['target'] ?? 1),
            'plies' => 2,
            'score' => [
                'white' => (int) ($sm['score']['white'] ?? 0),
                'black' => (int) ($sm['score']['black'] ?? 0),
            ],
            'cube' => [
                'value' => (int) ($sm['cube']['value'] ?? 1),
                'owner' => $sm['cube']['owner'] ?? null,
            ],
        ];
    }

    /** Aday nesnesinden (validator {steps,resultKey} | gnubg {move,steps}) adımları çıkar. */
    private function stepsOf(array $cand): array
    {
        $steps = $cand['steps'] ?? [];

        return is_array($steps) ? array_values($steps) : [];
    }

    /** Adımların from/to imzası (die HARİÇ; sıra bağımsız) — iki motor arası hamle eşleme anahtarı. */
    private function fromToKey(array $steps): string
    {
        $pairs = [];
        foreach ($steps as $s) {
            if (! is_array($s)) {
                continue;
            }
            $pairs[] = ($s['from'] ?? '?').'>'.($s['to'] ?? '?');
        }
        sort($pairs);

        return implode(',', $pairs);
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

    /** server_state + server_match -> gnubg /analyze konum sözlüğü. */
    private function positionFor(array $state, array $sm): array
    {
        $dice = array_values(array_filter(array_map('intval', $state['dice'] ?? [])));

        return [
            'points' => array_map('intval', $state['points'] ?? []),
            'turn' => $state['turn'] ?? 'white',
            // gnubg 2 zar bekler; çift [d,d,d,d] -> [d,d].
            'dice' => array_slice($dice, 0, 2),
            'matchLength' => (int) ($sm['target'] ?? 1),
            'plies' => 2,
            'score' => [
                'white' => (int) ($sm['score']['white'] ?? 0),
                'black' => (int) ($sm['score']['black'] ?? 0),
            ],
            'cube' => [
                'value' => (int) ($sm['cube']['value'] ?? 1),
                'owner' => $sm['cube']['owner'] ?? null,
            ],
        ];
    }
}
