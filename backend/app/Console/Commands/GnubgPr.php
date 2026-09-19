<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Console\Command;

/**
 * Bir maçın logunu gnubg orkestratörüyle POZİSYON-POZİSYON analiz eder ve XG-benzeri karar tablosu
 * basar (turn/dice/played/best/bestEq/playedEq/loss/forced/counted) — her iki oyuncu için — sonunda
 * toplam equity kaybı + sayılan karar + PR. Kayıtlı client PR ile karşılaştırır (shadow doğrulama).
 *
 * Amaç: TavlaTV PR'ının XG'den neden farklı çıktığını KARAR BAZINDA görmek. gnubg match-aware
 * (mctx varsa skor/küp/crawford/matchLen) -> XG'ye en yakın referans. Laravel Toolkit / artisan'dan:
 *   php artisan tavla:gnubg-pr            (log dolu son maç, iki oyuncu)
 *   php artisan tavla:gnubg-pr 123        (match_results id=123)
 *   php artisan tavla:gnubg-pr 123 --player=white
 */
class GnubgPr extends Command
{
    protected $signature = 'tavla:gnubg-pr {id? : match_results id (boş = log dolu son maç)} {--player= : white|black (boş = ikisi)} {--full : tüm kararları göster}';

    protected $description = 'Bir maçı gnubg ile pozisyon-pozisyon analiz eder; XG-benzeri karar tablosu + PR (client PR ile karşılaştırır).';

    public function handle(AnalysisOrchestrator $orch): int
    {
        $mr = $this->argument('id')
            ? MatchResult::find($this->argument('id'))
            : MatchResult::whereNotNull('log')->latest('id')->first();

        if (! $mr || empty($mr->log)) {
            $this->error('Log dolu maç bulunamadı (önce bir maç oyna veya geçerli id ver).');

            return self::FAILURE;
        }
        $decoded = json_decode($mr->log, true);
        if (! is_array($decoded) || empty($decoded['log'])) {
            $this->error('Log parse edilemedi veya boş.');

            return self::FAILURE;
        }
        $log = $decoded['log'];
        $ml = (int) ($mr->match_length ?? 0); // mctx varsa karar-başı match-aware kullanılır

        $this->line("Maç #{$mr->id}  log-sahibi={$decoded['hc']}  match_length=$ml  log-entry=".count($log)
            .'  client_pr='.($mr->pr ?? 'null'));

        $players = $this->option('player') ? [$this->option('player')] : ['white', 'black'];
        foreach ($players as $player) {
            $this->printPlayer($orch, $log, $player, $ml, (bool) $this->option('full'));
        }

        $this->info('Bitti. (gnubg checker; mctx varsa match-aware = XG referansı, yoksa money.)');

        return self::SUCCESS;
    }

    private function printPlayer(AnalysisOrchestrator $orch, array $log, string $player, int $ml, bool $full): void
    {
        $r = $orch->checkerPr($log, $player, $ml, 2);
        $c = $orch->cubePr($log, $player, $ml);

        $this->line('');
        $this->line("==== $player ====");
        $rows = $full ? $r['perDecision'] : array_slice($r['perDecision'], 0, 40);
        $this->table(
            ['#', 'dice', 'played', 'best', 'bestEq', 'playedEq', 'loss', 'legal', 'forced', 'PR?'],
            array_map(function ($d, $i) {
                return [
                    $i + 1,
                    implode('', $d['dice'] ?? []),
                    $this->short($d['move'] ?? '?'),
                    $this->short($d['bestMove'] ?? '?'),
                    number_format((float) ($d['bestEquity'] ?? 0), 4),
                    number_format((float) ($d['playedEquity'] ?? 0), 4),
                    number_format((float) ($d['loss'] ?? 0), 4),
                    $d['legal'] ?? '?',
                    ($d['forced'] ?? false) ? 'evet' : '',
                    ($d['counts'] ?? false) ? '✓' : '—',
                ];
            }, $rows, array_keys($rows))
        );
        if (! $full && count($r['perDecision']) > 40) {
            $this->line('  ... ('.(count($r['perDecision']) - 40).' karar daha; --full ile hepsi)');
        }

        $totLoss = $r['loss'] + $c['loss'];
        $totDec = $r['decisions'] + $c['decisions'];
        $overall = $totDec > 0 ? ($totLoss / $totDec) * 500 : ($r['pr'] ?: $c['pr']);
        $avg = $r['decisions'] > 0 ? $r['loss'] / $r['decisions'] : 0.0;

        $this->line(sprintf('  Toplam roll (checker değerlendirilen): %d', $r['evaluated']));
        $this->line(sprintf('  Sayılan karar (forced/obvious HARİÇ) : %d', $r['decisions']));
        $this->line(sprintf('  Toplam equity kaybı                  : %.4f', $r['loss']));
        $this->line(sprintf('  Ortalama equity kaybı                : %.4f', $avg));
        $this->line(sprintf('  gnubg CHECKER PR                     : %.2f', $r['pr']));
        $this->line(sprintf('  gnubg CUBE PR                        : %.2f  (sayılan %d)', $c['pr'], $c['decisions']));
        $this->line(sprintf('  gnubg GENEL PR                       : %.2f  (toplam sayılan %d)', $overall, $totDec));
    }

    private function short(?string $s): string
    {
        $s = (string) $s;

        return strlen($s) > 16 ? substr($s, 0, 15).'…' : $s;
    }
}
