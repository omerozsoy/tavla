<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use Illuminate\Console\Command;

/**
 * OTORİTER PR = gnubg'nin KENDİ "Snowie error rate"i (maç-cubeful MWC, küp DAHİL). gnubg .mat'ten
 * maç/money'yi otomatik ayırt eder (tek-oyun→money, puanlı→maç-cubeful) -> XG ile eşleşir. Bizim
 * eski yol probs'tan cubeless-para equity türetip ~2.4x şişiriyordu; bu komut gnubg'nin authoritative
 * istatistiğini kullanır.
 *
 * Kullanım: php artisan tavla:gnubg-snowie 59C8M [--plies=2]
 *   (gnubg CLI yolu: env GNUBG_CLI; local varsayılan AppData\Local\gnubg\gnubg-cli.exe)
 */
class GnubgSnowie extends Command
{
    protected $signature = 'tavla:gnubg-snowie {room} {--plies=2}';

    protected $description = 'gnubg CLI Snowie error rate (maç-cubeful, küp dahil) ile maç PR\'ı hesaplar';

    public function handle(): int
    {
        $room = strtoupper((string) $this->argument('room'));
        $plies = (int) $this->option('plies');
        $rows = MatchResult::where('room_code', $room)->orderBy('id')->get();
        if ($rows->isEmpty()) {
            $this->error("Oda bulunamadı: $room");

            return self::FAILURE;
        }
        $res = $this->analyze($rows->first()->matText(), $plies);
        if ($res === null) {
            $this->error('gnubg analizi başarısız (gnubg CLI yolu / çıktı).');

            return self::FAILURE;
        }
        [$p1Name, $p2Name, $p1Snowie, $p2Snowie] = $res;
        $this->info("Oda $room — gnubg {$plies}-ply Snowie error rate (küp dahil, maç-cubeful):");
        $this->line("  $p1Name: ".number_format($p1Snowie, 2));
        $this->line("  $p2Name: ".number_format($p2Snowie, 2));

        // .mat oyuncu (P1/P2) -> white/black eşlemesi (isim benzerliğiyle).
        foreach ($rows as $r) {
            $hc = $r->analysisHc();
            $nick = $this->asciiName((string) ($r->user?->nickname ?? $r->user?->name ?? ''));
            $pr = null;
            if ($nick !== '' && $this->nameMatch($nick, $p1Name)) {
                $pr = $p1Snowie;
            } elseif ($nick !== '' && $this->nameMatch($nick, $p2Name)) {
                $pr = $p2Snowie;
            }
            $this->line(sprintf('  row#%d hc=%s nick=%s -> Snowie PR=%s', $r->id, $hc, $nick, $pr !== null ? number_format($pr, 2) : '?'));
        }

        return self::SUCCESS;
    }

    /** gnubg CLI çalıştır, "Snowie error rate" satırından iki PR + oyuncu isimleri döndür. */
    private function analyze(string $mat, int $plies): ?array
    {
        $mat = $this->asciiName($mat);
        $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gsnowie_'.uniqid();
        $matFile = $tmp.'.mat';
        $cmdFile = $tmp.'.txt';
        file_put_contents($matFile, str_replace("\r\n", "\n", $mat));
        $cmds = implode("\n", [
            "set analysis chequerplay evaluation plies $plies",
            "set analysis cubedecision evaluation plies $plies",
            'set analysis luck off',
            'import mat "'.str_replace('\\', '/', $matFile).'"',
            'analyse match',
            'show statistics match',
            'quit',
        ]);
        file_put_contents($cmdFile, $cmds);

        $cli = (string) env('GNUBG_CLI', 'C:/Users/Master/AppData/Local/gnubg/gnubg-cli.exe');
        $out = [];
        $code = 0;
        exec('"'.$cli.'" -t -q -c "'.$cmdFile.'" 2>&1', $out, $code);
        @unlink($matFile);
        @unlink($cmdFile);
        $text = implode("\n", $out);

        // Oyuncu isimleri: "Player   P1   P2"
        $p1 = $p2 = '';
        if (preg_match('/^Player\s+(.+?)\s{2,}(.+?)\s*$/m', $text, $m)) {
            $p1 = trim($m[1]);
            $p2 = trim($m[2]);
        }
        // Snowie error rate satırı: iki ana sayı (virgül ondalık, %'leri atla).
        if (! preg_match('/Snowie error rate\s+(-?\d+[.,]\d+)\s+\([^)]*\)\s+(-?\d+[.,]\d+)/', $text, $s)) {
            return null;
        }
        $f = fn ($v) => abs((float) str_replace(',', '.', $v));

        return [$p1 ?: 'P1', $p2 ?: 'P2', $f($s[1]), $f($s[2])];
    }

    private function nameMatch(string $a, string $b): bool
    {
        $n = fn ($x) => strtolower(preg_replace('/[^a-z0-9]/i', '', $x));

        return $n($a) !== '' && $n($a) === $n($b);
    }

    private function asciiName(string $s): string
    {
        $tr = ['Ö' => 'O', 'ö' => 'o', 'Ğ' => 'G', 'ğ' => 'g', 'İ' => 'I', 'ı' => 'i', 'Ş' => 'S', 'ş' => 's', 'Ç' => 'C', 'ç' => 'c', 'Ü' => 'U', 'ü' => 'u'];

        return preg_replace('/[^\x00-\x7F]/', '', strtr($s, $tr));
    }
}
