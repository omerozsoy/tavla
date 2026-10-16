<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Console\Command;

/**
 * PR'ı gnubg_review (reviewMatch, tam .mat = SUNUCU match_moves) LOG'undan YENİDEN türetip match_results'ı
 * düzeltir. Buggy per-pozisyon cubePr yüzünden YANLIŞ yazılmış küp/genel PR'ları onarır (EU6CD: kusursuz
 * oyuncuya 18.54 PR -> gerçek ~1). Yalnız gnubg_review'i OLAN satırlar işlenir (review = tek doğru kaynak).
 *
 * Kullanım: php artisan tavla:pr-from-review [--room=CODE] [--id=N] [--since=2026-10-01] [--apply]
 *   --apply YOKSA dry-run (yalnız farkları listeler, YAZMAZ).
 */
class PrFromReview extends Command
{
    protected $signature = 'tavla:pr-from-review {--room=} {--id=} {--since=} {--limit=100000} {--apply} {--resume}';

    protected $description = 'PR/küp PR\'ı gnubg_review\'dan yeniden türetip düzeltir (buggy cubePr + çöp-kalkanı onarımı)';

    public function handle(AnalysisOrchestrator $orch): int
    {
        $apply = (bool) $this->option('apply');
        $resume = (bool) $this->option('resume');
        $limit = max(1, (int) $this->option('limit'));
        // RESUME İMLECİ (büyük backfill, OOM-dayanıklı): --resume -> yalnız pr_shield_at NULL satırlar
        // işlenir, her satır işlenince (apply'da) now() damgalanır -> kesinti/OOM'da KALDIĞI YERDEN devam
        // (baştan hesap yok). --limit koşu başına üst sınır; döngüde çağır (while remaining>0) ya da tek
        // koşuda yüksek memory_limit ile bitir. İmleç kolonu yoksa (migrate bekliyor) resume devre dışı.
        $hasShield = \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'pr_shield_at');
        if ($resume && ! $hasShield) {
            $this->warn('pr_shield_at kolonu yok (migrate bekliyor) -> --resume devre disi, tam tarama.');
            $resume = false;
        }
        // UZUN BACKFILL BELLEK: query log her sorguyu bellekte tutar (analysisHc satır başına Room sorgusu
        // yapar -> ~10K sorgu birikir) + büyük review decode'ları. 9664 satırda 128MB'ı aşıyordu. Query
        // log'u kapat (APP_DEBUG açıksa aç olur) + her parti sonrası gc_collect_cycles -> bellek düz kalır.
        \Illuminate\Support\Facades\DB::connection()->disableQueryLog();
        $q = MatchResult::query()
            ->whereNotNull('gnubg_review')
            ->whereNotNull('room_code');
        if ($resume) {
            $q->whereNull('pr_shield_at'); // yalnız henüz işlenmemiş satırlar (imleç)
        }
        if ($this->option('room')) {
            $q->where('room_code', strtoupper((string) $this->option('room')));
        }
        if ($this->option('id')) {
            $q->where('id', (int) $this->option('id'));
        }
        if ($this->option('since')) {
            $q->where('created_at', '>=', (string) $this->option('since'));
        }
        $remaining = $q->count();
        $this->info(($apply ? 'UYGULA' : 'DRY-RUN').($resume ? ' [resume]' : '').': '.$remaining." satir islenecek (bu kosu <= {$limit})");
        $fixed = 0;
        $skipped = 0;
        $processed = 0;
        // chunkById: uzak DB'de review blokları BÜYÜK (ort ~771KB, bazıları ~2.6MB) -> tek get() 9640 satır
        // = GB'larca RAM (OOM). 150'lik parti bile 128MB CLI limitini aşıyordu (150 x ~771KB+ + decode).
        // 20'lik parti = en kötü ~20x2.6MB ≈ 52MB -> güvenli. Her parti sonrası bellek serbest bırakılır.
        $stamp = $apply && $resume && $hasShield; // imleci yalnız gerçekten yazarken (apply+resume) ilerlet
        $q->orderBy('id')->chunkById(20, function ($rows) use ($orch, $apply, $stamp, $limit, &$fixed, &$skipped, &$processed) {
        $chunkIds = [];
        foreach ($rows as $r) {
            $chunkIds[] = $r->id;
            $review = json_decode((string) $r->gnubg_review, true);
            $log = is_array($review['log'] ?? null) ? $review['log'] : null;
            $hc = $r->analysisHc();
            if (! $log || ! in_array($hc, ['white', 'black'], true)) {
                $skipped++;

                continue;
            }
            $self = $orch->prFromReviewLog($log, $hc);
            $opp = $orch->prFromReviewLog($log, $hc === 'white' ? 'black' : 'white');

            // SAHTE-0 KALKANI (AnalyzeMatchPrJob ile AYNI konvansiyon): skorlanan karar yoksa (decisions=0)
            // PR TANIMSIZ -> null. round(0)=0 YAZMA; yoksa 81/88 meşru "—" satırı sahte 0'a dönüp bozulur.
            $newPr = ($self['decisions'] ?? 0) > 0 ? round($self['pr'], 2) : null;
            $oldPr = $r->gnubg_pr !== null ? round((float) $r->gnubg_pr, 2) : null;
            // LEGACY opponent_pr = otoriter opp PR (gnubg_opponent_pr ile birebir). Backfill bunu da senkron
            // tutmalı; yoksa gnubg_pr doğruyken opponent_pr stale birikir (frontend fallback kolonu).
            $newOppPr = ($opp['decisions'] ?? 0) > 0 ? round($opp['pr'], 2) : null;
            $oldOppPr = $r->opponent_pr !== null ? round((float) $r->opponent_pr, 2) : null;
            // null<->değer geçişi de fark sayılır; ikisi de doluysa 0.01 eşiği.
            $prDiff = (($oldPr === null) !== ($newPr === null)) || ($newPr !== null && abs($newPr - $oldPr) > 0.01);
            $oppDiff = (($oldOppPr === null) !== ($newOppPr === null)) || ($newOppPr !== null && abs($newOppPr - $oldOppPr) > 0.01);
            if (! $prDiff && ! $oppDiff) {
                $skipped++;

                continue;
            }
            $f2 = static fn ($v) => $v === null ? '—' : number_format((float) $v, 2);
            $this->line(sprintf('#%d %s: PR %s -> %s | oppPR %s -> %s | cube %s -> %s',
                $r->id, $r->room_code, $f2($oldPr), $f2($newPr), $f2($oldOppPr), $f2($newOppPr),
                $f2($r->gnubg_cube_pr), $f2($self['cube_pr'])));

            if ($apply) {
                MatchResult::where('id', $r->id)->update([
                    'gnubg_pr' => $newPr,
                    'gnubg_checker_pr' => $self['checker_pr'] !== null ? round($self['checker_pr'], 2) : null,
                    'gnubg_cube_pr' => $self['cube_pr'] !== null ? round($self['cube_pr'], 2) : null,
                    'pr_equity_lost' => round($self['equity_lost'], 4),
                    'pr_decisions' => $self['decisions'],
                    'pr' => $newPr, // gösterilen (eski istemci pr yerine yetkili review PR)
                    'gnubg_opponent_pr' => $newOppPr,
                    'opponent_pr' => $newOppPr, // legacy fallback kolonu = otoriter review opp PR (stale birikmesin)
                    'gnubg_opponent_checker_pr' => $opp['checker_pr'] !== null ? round($opp['checker_pr'], 2) : null,
                    'gnubg_opponent_cube_pr' => $opp['cube_pr'] !== null ? round($opp['cube_pr'], 2) : null,
                ]);
                // Rakip satırı (varsa) da aynı review'dan: onun opponent_pr'ı = benim self PR'ım.
                MatchResult::where('room_code', $r->room_code)->where('user_id', '!=', $r->user_id)
                    ->update(['opponent_pr' => $newPr]);
            }
            $fixed++;
            unset($review, $log, $self, $opp);
        }
        // İMLEÇ: işlenen TÜM satırları (değişsin değişmesin) damgala -> sonraki koşu bunları atlar.
        if ($stamp && $chunkIds) {
            MatchResult::whereIn('id', $chunkIds)->update(['pr_shield_at' => now()]);
        }
        $processed += count($rows);
        gc_collect_cycles(); // parti sonrası döngüsel referansları serbest bırak -> bellek düz kalır
        if ($processed >= $limit) {
            return false; // bu koşu kotası doldu -> dur (resume ile kaldığı yerden devam eder)
        }
        });
        $this->info(($apply ? 'Düzeltildi' : 'Düzeltilecek').": $fixed | atlandı: $skipped | bu kosuda islenen: $processed");

        return self::SUCCESS;
    }
}
