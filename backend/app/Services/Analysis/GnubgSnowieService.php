<?php

namespace App\Services\Analysis;

/**
 * OTORİTER PR = gnubg CLI'nin "Snowie error rate"i (maç-cubeful MWC, küp DAHİL). gnubg .mat'ten
 * maç/money'yi otomatik ayırt eder (tek-oyun→money, puanlı→maç-cubeful) -> XG ile eşleşir. Eski
 * yol probs'tan cubeless-para equity türetip ~2.4x şişiriyordu.
 *
 * KİLİT: analiz ayarları (plies, cubeful, luck off) burada SABİT ve yorumlu; regresyon testi
 * sabit .mat'te beklenen Snowie'yi doğrular -> ayar sapması deploy'dan önce yakalanır.
 */
class GnubgSnowieService
{
    public const PLIES = 2; // XG'ye 2-ply yeter (3/4-ply ~0.2 fark, 75x yavaş); SABİT.

    /** gnubg CLI yolu (local Windows default; prod'da env GNUBG_CLI). */
    public function cliPath(): string
    {
        return (string) env('GNUBG_CLI', 'C:/Users/Master/AppData/Local/gnubg/gnubg-cli.exe');
    }

    /**
     * .mat'i gnubg ile analiz et -> [p1Name, p2Name, p1Snowie, p2Snowie] | null.
     * Snowie = overall (checker+küp) error rate, abs değer (PR).
     */
    public function analyzeMat(string $mat, ?int $plies = null): ?array
    {
        $plies = $plies ?? self::PLIES;
        $mat = $this->ascii($mat);
        if (trim($mat) === '') {
            return null;
        }
        $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gsnowie_'.uniqid('', true);
        $matFile = $tmp.'.mat';
        $cmdFile = $tmp.'.txt';
        file_put_contents($matFile, str_replace("\r\n", "\n", $mat));
        file_put_contents($cmdFile, implode("\n", [
            "set analysis chequerplay evaluation plies $plies",
            "set analysis cubedecision evaluation plies $plies",
            'set analysis luck off',
            'import mat "'.str_replace('\\', '/', $matFile).'"',
            'analyse match',
            'show statistics match',
            'quit',
        ]));
        $out = [];
        $code = 0;
        exec('"'.$this->cliPath().'" -t -q -c "'.$cmdFile.'" 2>&1', $out, $code);
        @unlink($matFile);
        @unlink($cmdFile);

        return $this->parseSnowie(implode("\n", $out));
    }

    /**
     * gnubg "show statistics match" çıktısından [p1Name, p2Name, p1Snowie, p2Snowie] ayıkla.
     * exec'ten AYRI -> CI'da kanned çıktıyla test edilebilir (parse regresyonu yakalanır).
     */
    public function parseSnowie(string $text): ?array
    {
        $p1 = $p2 = '';
        if (preg_match('/^Player\s+(.+?)\s{2,}(.+?)\s*$/m', $text, $m)) {
            $p1 = trim($m[1]);
            $p2 = trim($m[2]);
        }
        // "Snowie error rate" = overall (checker+küp), iki ana sayı (virgül/nokta ondalık, %'leri atla).
        if (! preg_match('/Snowie error rate\s+(-?\d+[.,]\d+)\s+\([^)]*\)\s+(-?\d+[.,]\d+)/', $text, $s)) {
            return null;
        }
        $f = fn ($v) => round(abs((float) str_replace(',', '.', $v)), 2);
        [$pr1, $pr2] = [$f($s[1]), $f($s[2])];
        // Çöp koruması: gerçek PR ~0-50. Absürt değer gnubg'nin güvenilmez analizini gösterir —
        // ör. canlı-küplü money maçı "1 point match" başlığıyla verilince küpü ölü sanıp milyonluk
        // hata üretir. Böyle sonucu "analiz yok" (null) say -> DB'ye çöp yazılmaz.
        // ponytail: 100 sabit eşik; gerçek en-kötü oyuncu ~50'yi aşmaz, gerekirse yükselt.
        if ($pr1 > 100 || $pr2 > 100) {
            return null;
        }

        return [$p1 ?: 'P1', $p2 ?: 'P2', $pr1, $pr2];
    }

    /**
     * OTORİTER PR = gnubg'nin KENDİ maç istatistiği (XG ile birebir: 7669 By_tgg gnubg Snowie 51.4
     * ~ XG 56.24; bizim eski review-log yöntemi 327 veriyordu, ~6x şişik — review 'loss' değerleri
     * match-play'de yanlış ölçekte). GnuBgClient::analyzeMatch sonucundan per-oyuncu PR çıkarır:
     *   pr          = |Snowie error rate|            (genel, XG "PR")
     *   checker_pr  = pr × checker_err / toplam_err  (Snowie'yi kategoriye böl -> toplamı pr eder)
     *   cube_pr     = pr × cube_err / toplam_err      (yalnız ≥MIN küp kararında, aksi null)
     * "Error total EMG" ham metinde SIRAYLA Checkerplay→Cube→Overall geçer -> tek regex ile 3'ü de.
     *
     * @param  array|null  $res  GnuBgClient::analyzeMatch() dönüşü (players + statistics_match)
     * @return array|null  [0=>p0, 1=>p1] her biri {pr,checker_pr,cube_pr,cube_decisions} | null (çöp/yok)
     */
    public function snowieFromAnalyze(?array $res, int $minCubeDecisions = 1): ?array
    {
        if (! is_array($res) || empty($res['ok'])) {
            return null;
        }
        $players = $res['players'] ?? null;
        $raw = (string) ($res['statistics_match'] ?? '');
        if (! is_array($players) || count($players) < 2 || trim($raw) === '') {
            return null;
        }
        $f = static fn ($v) => abs((float) str_replace(',', '.', (string) $v));
        // "Error total EMG (MWC)   -2.019 (..%)   -9.318 (..%)" SIRAYLA checker, cube, overall.
        preg_match_all('/Error total EMG[^\n\-]*(-?\d+[.,]\d+)\s*\([^)]*\)\s+(-?\d+[.,]\d+)/', $raw, $em);
        preg_match('/Close or actual cube decisions\s+(\d+)\s+(\d+)/', $raw, $cd); // küp PR gösterim kapısı
        preg_match('/Total moves\s+(\d+)\s+(\d+)/', $raw, $tm);                    // Snowie paydası (tüm hamle)
        preg_match('/Total cube decisions\s+(\d+)\s+(\d+)/', $raw, $tc);            // Snowie paydası (tüm küp)
        // OTORİTER Snowie oranı HAM METİNDEN (iki oyuncu) — parseSnowie ile AYNI regex. KÖK BUG:
        // players[].snowieErrorRate (Python gnubg_service parse'ı) 2. OYUNCU için bazen 0 geliyordu
        // -> maçın o tarafı HİÇ yazılamayıp eski ŞİŞİK review değerinde kalıyordu (örn. 9JC5A Ömer
        // 15.14/küp 69.33 sabit kaldı; ham metin -10.6 diyordu). Ham satır güvenilir; players[] fallback.
        $snowieTxt = [null, null];
        if (preg_match('/Snowie error rate\s+(-?\d+[.,]\d+)\s+\([^)]*\)\s+(-?\d+[.,]\d+)/', $raw, $sm)) {
            $snowieTxt = [$f($sm[1]), $f($sm[2])];
        }
        $chkErr = [isset($em[1][0]) ? $f($em[1][0]) : null, isset($em[2][0]) ? $f($em[2][0]) : null];
        $cubErr = [isset($em[1][1]) ? $f($em[1][1]) : null, isset($em[2][1]) ? $f($em[2][1]) : null];
        $ovErr = [isset($em[1][2]) ? $f($em[1][2]) : null, isset($em[2][2]) ? $f($em[2][2]) : null];
        $cubeDec = [(int) ($cd[1] ?? 0), (int) ($cd[2] ?? 0)];
        // Snowie paydası (kariyer ağırlığı). GÜVENİLİR yol: gnubg'nin KENDİ Snowie'sinden geri-türet
        // dec = err×1000/Snowie (By_tgg 2.569×1000/51.4=50; maç 1448 1.908×1000/20.94=91). "Total moves"
        // regex'i bazı çok-oyunlu çıktılarda yanlış sayı veriyordu (1448: 16) -> geri-türetme kesin.
        // Fallback: Snowie 0/parse yoksa ham "Total moves + Total cube" (eski yol).
        $parsedDec = [(int) ($tm[1] ?? 0) + (int) ($tc[1] ?? 0), (int) ($tm[2] ?? 0) + (int) ($tc[2] ?? 0)];

        $out = [];
        foreach ([0, 1] as $i) {
            $prRaw = $snowieTxt[$i] ?? abs((float) ($players[$i]['snowieErrorRate'] ?? 0));
            // YOK (0) veya BOZUK-analiz (milyonlar; ör. canlı-küplü maç "1 point" başlığıyla -> küp ölü
            // sanılır) -> null. gnubg'nin gerçek en-kötü Snowie'si ~birkaç yüz; >1000 = güvenilmez.
            if ($prRaw <= 0 || $prRaw > 1000) {
                $out[$i] = null;

                continue;
            }
            // XG-birebir: XG PR'ı 100'de CAP'ler (maç 7669 KUPABEYİ: XG 100.00 vs gnubg 190.9).
            $pr = min($prRaw, 100.0);
            $ce = $chkErr[$i];
            $ue = $cubErr[$i];
            $tot = ($ce ?? 0.0) + ($ue ?? 0.0);
            $checkerPr = ($ce !== null && $tot > 0) ? round($pr * $ce / $tot, 2) : null;
            $cubePr = ($ue !== null && $tot > 0 && $cubeDec[$i] >= $minCubeDecisions) ? round($pr * $ue / $tot, 2) : null;
            $out[$i] = [
                'pr' => round($pr, 2),
                'checker_pr' => $checkerPr,
                'cube_pr' => $cubePr,
                'cube_decisions' => $cubeDec[$i], // "close or actual" (küp kariyeri + MIN kapısı)
                'cube_equity_lost' => $ue !== null ? round($ue, 4) : null, // küp err EMG (kariyer küp PR için)
                'equity_lost' => $ovErr[$i] !== null ? round($ovErr[$i], 4) : null, // kariyer için (overall err EMG)
                // dec = err×1000/Snowie (gnubg'nin KENDİ paydası, kesin); yoksa parse fallback.
                'decisions' => ($ovErr[$i] !== null && $prRaw > 0)
                    ? (int) round($ovErr[$i] * 1000 / $prRaw)
                    : $parsedDec[$i],
            ];
        }

        return $out;
    }

    /** İki ismin ASCII-normalize eşleşmesi (P1/P2 -> white/black için). */
    public function nameMatch(string $a, string $b): bool
    {
        $n = fn ($x) => strtolower(preg_replace('/[^a-z0-9]/i', '', $this->ascii($x)));

        return $n($a) !== '' && $n($a) === $n($b);
    }

    public function ascii(string $s): string
    {
        $tr = ['Ö' => 'O', 'ö' => 'o', 'Ğ' => 'G', 'ğ' => 'g', 'İ' => 'I', 'ı' => 'i', 'Ş' => 'S', 'ş' => 's', 'Ç' => 'C', 'ç' => 'c', 'Ü' => 'U', 'ü' => 'u'];

        return preg_replace('/[^\x00-\x7F]/', '', strtr($s, $tr));
    }
}
