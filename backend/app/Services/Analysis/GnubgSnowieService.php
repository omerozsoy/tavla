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

        return [$p1 ?: 'P1', $p2 ?: 'P2', $f($s[1]), $f($s[2])];
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
