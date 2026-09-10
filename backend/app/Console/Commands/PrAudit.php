<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use Illuminate\Console\Command;

/**
 * PR DENETIM ARACI — bir macin KAYITLI (client/wildbg) PR kirilimini log'dan yeniden uretir.
 * Motor CALISTIRMAZ; yalnizca log'a yazilmis countsForPR/prAdjustedEquityLoss alanlarini toplar
 * (gosterilen PR ile BIREBIR ayni matematik: PrPool + src/analysis/pr.ts).
 *
 * Amac (kullanicinin E maddesi): ayni mac icin
 *   - checker decisions (sayilan / degerlendirilen / obvious-haric)
 *   - cube decisions
 *   - forced / no-move (kayda hic girmez -> not olarak gosterilir)
 *   - checker error / cube error / toplam
 *   - checker PR / cube PR / genel PR
 * XG cikti(su) ile yan yana koymak icin.  gnubg (match-aware, XG-proxy) karsilastirmasi:
 * `php artisan tavla:gnubg-pr {id}` (ayri komut).
 */
class PrAudit extends Command
{
    protected $signature = 'tavla:pr-audit {id? : match_results id (bos = log dolu son mac)} {--player= : white|black (bos = log hc)}';

    protected $description = 'Bir macin KAYITLI PR kirilimini log’dan yeniden uretir (checker/cube decision + error + PR).';

    public function handle(): int
    {
        $mr = $this->argument('id')
            ? MatchResult::find($this->argument('id'))
            : MatchResult::whereNotNull('log')->latest('id')->first();
        if (! $mr || empty($mr->log)) {
            $this->error('Log dolu bir mac bulunamadi.');

            return self::FAILURE;
        }
        $decoded = json_decode($mr->log, true);
        if (! is_array($decoded) || empty($decoded['log']) || ! is_array($decoded['log'])) {
            $this->error('Log parse edilemedi / bos.');

            return self::FAILURE;
        }
        // Log tek-yazar: kaydi yazan oyuncunun (hc) kararlarini icerir. --player ile daralt.
        $only = $this->option('player') ?: null;
        $hc = $decoded['hc'] ?? 'white';

        $c = ['eval' => 0, 'count' => 0, 'obvious' => 0, 'err' => 0.0, 'raw' => 0.0];
        $cube = ['eval' => 0, 'count' => 0, 'obvious' => 0, 'err' => 0.0, 'raw' => 0.0];
        $fill = 0;

        foreach ($decoded['log'] as $e) {
            if (! is_array($e)) {
                continue;
            }
            if ($only !== null && ($e['player'] ?? $hc) !== $only) {
                continue;
            }
            if (! empty($e['fill'])) {
                $fill++;   // MAT tur-sirasi dolgusu (zorunlu/dance) — karar DEGIL

                continue;
            }
            $isCube = array_key_exists('cube', $e);
            $bucket = $isCube ? 'cube' : 'checker';
            $ref = $isCube ? $cube : $c;

            $counts = array_key_exists('countsForPR', $e) ? (bool) $e['countsForPR'] : ! $isCube;
            $adj = (float) ($e['prAdjustedEquityLoss'] ?? $e['loss'] ?? 0);
            $rawLoss = (float) ($e['loss'] ?? $adj);

            $ref['eval']++;
            $ref['raw'] += max(0.0, $rawLoss);
            if ($counts) {
                $ref['count']++;
                $ref['err'] += max(0.0, $adj);
            } else {
                $ref['obvious']++;
            }
            if ($isCube) {
                $cube = $ref;
            } else {
                $c = $ref;
            }
        }

        $pr = fn (float $err, int $n): ?float => $n > 0 ? round(($err / $n) * 500, 2) : null;
        $totErr = $c['err'] + $cube['err'];
        $totDec = $c['count'] + $cube['count'];

        $this->line('');
        $this->line("=== PR DENETIMI — mac #{$mr->id} ===");
        $this->line('oyuncu (hc)      : '.$hc.($only ? "  (filtre: $only)" : ''));
        $this->line('match_length     : '.($mr->match_length ?? 0).'  (1 => checker/cube error ×1.5 uygulanmis)');
        $this->line('match_type       : '.($mr->match_type ?? '?'));
        $this->line('log entry (ham)  : '.count($decoded['log']).'   fill/no-move-dolgu: '.$fill);
        $this->line('');
        $this->line('CHECKER  degerlendirilen='.$c['eval'].'  SAYILAN(payda)='.$c['count'].'  obvious-haric='.$c['obvious']);
        $this->line('         checker error (Σ, ×1.5 dahil) = '.round($c['err'], 4).'   -> Checker PR = '.($pr($c['err'], $c['count']) ?? '—'));
        $this->line('CUBE     degerlendirilen='.$cube['eval'].'  SAYILAN(payda)='.$cube['count'].'  obvious-haric='.$cube['obvious']);
        $this->line('         cube error (Σ) = '.round($cube['err'], 4).'   -> Cube PR = '.($pr($cube['err'], $cube['count']) ?? '—'));
        $this->line('');
        $this->line('GENEL    payda(decision)='.$totDec.'   toplam error='.round($totErr, 4).'   -> PR = '.($pr($totErr, $totDec) ?? '—'));
        $this->line('');
        $this->line('--- FORCED / NO-MOVE ---');
        $this->line('  Kayit aninda ELENIR: recordPR moves.length<=1 (forced) ve steps.length==0 (no-move/dance)');
        $this->line('  ise HIC log’a yazilmaz -> paydaya GIRMEZ (XG ile ayni). Log’daki fill='.$fill.' MAT dolgusudur.');
        $this->line('');
        $this->line('--- KAYITLI DEGERLER (dogrulama) ---');
        $this->line('  match_results.pr           = '.($mr->pr ?? 'null').'   (gosterilen PR)');
        $this->line('  pr_equity_lost / decisions = '.($mr->pr_equity_lost ?? 'null').' / '.($mr->pr_decisions ?? 'null'));
        foreach (['gnubg_pr', 'gnubg_checker_pr', 'gnubg_cube_pr'] as $col) {
            if (isset($mr->{$col})) {
                $this->line("  {$col} = ".$mr->{$col}.'  (gnubg match-aware SHADOW — XG-proxy)');
            }
        }
        $this->line('');
        $this->info('XG ile karsilastirma: yukaridaki payda/error/PR degerlerini XG ciktisiyla eslestir.');
        $this->info('gnubg (XG-benzeri motor, match-aware) icin: php artisan tavla:gnubg-pr '.$mr->id);

        return self::SUCCESS;
    }
}
