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
    protected $signature = 'tavla:gnubg-pr {id? : match_results id VEYA room_code (boş = son maç)} {--player= : white|black (boş = ikisi)} {--full : tüm kararları göster}';

    protected $description = 'Bir maçı gnubg ile pozisyon-pozisyon analiz eder; XG-benzeri karar tablosu + PR. SUNUCU-OTORİTER kaynak (match_moves) kullanılır (PR job ile aynı).';

    public function handle(AnalysisOrchestrator $orch): int
    {
        // Argüman: sayısal -> match_results id; değilse -> room_code; boş -> son maç.
        $arg = $this->argument('id');
        if ($arg === null) {
            $mr = MatchResult::whereNotNull('log')->latest('id')->first();
        } elseif (ctype_digit((string) $arg)) {
            $mr = MatchResult::find((int) $arg);
        } else {
            $mr = MatchResult::where('room_code', strtoupper((string) $arg))->latest('id')->first();
        }

        if (! $mr) {
            $this->error('Maç bulunamadı (geçerli id veya room_code ver).');

            return self::FAILURE;
        }
        // SUNUCU-OTORİTER analiz logu (match_moves varsa ORADAN; yoksa client) — PR job ile AYNI kaynak.
        $log = $mr->analysisLog();
        $hc = $mr->analysisHc() ?? 'white';
        if (empty($log)) {
            $this->error('Analiz logu boş (match_moves + client log yok).');

            return self::FAILURE;
        }
        $ml = (int) ($mr->match_length ?? 0); // mctx varsa karar-başı match-aware kullanılır
        $src = (! empty($mr->room_code) && \App\Models\MatchMove::existsForRoom($mr->room_code)) ? 'match_moves(sunucu)' : 'client-log';

        $this->line("Maç #{$mr->id}  room={$mr->room_code}  kaynak=$src  hc=$hc  match_length=$ml  log-entry=".count($log)
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

        // TEŞHİS: atlanan hamleler (no_match = gnubg aday listesiyle eşleşmedi) -> hatalar DÜŞÜYOR.
        // Bu sayı yüksekse (ve XG'den düşük PR çıkıyorsa) played-move eşleme bug'ı (bkz. gnubg_service).
        $reasons = $r['skipReasons'] ?? [];
        $this->line(sprintf('  ATLANAN hamle (skipped)              : %d  [no_match=%d, gnubg_null=%d, no_content=%d]',
            $r['skipped'] ?? 0, $reasons['no_match'] ?? 0, $reasons['gnubg_null'] ?? 0, $reasons['no_content'] ?? 0));
        if (! empty($r['firstSkip'])) {
            $this->line('  İlk atlama örneği                    : '.json_encode($r['firstSkip'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }
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
