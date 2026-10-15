<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\GnubgSnowieService;
use Illuminate\Console\Command;

/**
 * GEÇMİŞ PR'ları gnubg Snowie error rate'ine (maç-cubeful, küp dahil, XG-eşleşen) çek. Her oda BİR
 * gnubg analiziyle iki oyuncunun PR'ını verir; iki satıra yazılır (self + opponent aynalı).
 *
 * PARALEL: --workers N ile N kopya çalıştır, her biri --shard 0..N-1; oda index % N == shard olanları işler.
 *   php artisan tavla:snowie-backfill --workers=8 --shard=0 --apply   (0..7 ayrı süreç)
 * Ölçüm: --limit=20 (apply'sız) -> per-oda süre tahmini.
 */
class SnowieBackfill extends Command
{
    protected $signature = 'tavla:snowie-backfill {--workers=1} {--shard=0} {--limit=0} {--apply}';

    protected $description = 'Geçmiş PR\'ları gnubg Snowie error rate\'ine çeker (maç-cubeful, küp dahil)';

    public function handle(GnubgSnowieService $svc): int
    {
        $workers = max(1, (int) $this->option('workers'));
        $shard = (int) $this->option('shard');
        $limit = (int) $this->option('limit');
        $apply = (bool) $this->option('apply');

        $rooms = MatchResult::whereNotNull('gnubg_review')->whereNotNull('room_code')
            ->orderBy('room_code')->distinct()->pluck('room_code')->all();
        // shard dağıt
        $mine = [];
        foreach ($rooms as $i => $rc) {
            if ($i % $workers === $shard) {
                $mine[] = $rc;
            }
        }
        if ($limit > 0) {
            $mine = array_slice($mine, 0, $limit);
        }
        $this->info(($apply ? 'UYGULA' : 'KURU').": shard $shard/$workers — ".count($mine).' oda');

        $done = $skip = 0;
        $start = microtime(true);
        foreach ($mine as $rc) {
            $rows = MatchResult::where('room_code', $rc)->orderBy('id')->get();
            if ($rows->isEmpty()) {
                $skip++;

                continue;
            }
            // Money (bahisli, CANLI KÜP) oyunu 1-puanlık match olarak serialize ediliyor -> gnubg
            // küpü ölü sanıp çöp (milyonluk) PR üretir. Doğru analiz money-session (.mat "0 point
            // match") serileştirmesi ister; o AYRI iş. O yapılana dek money maçlarını ATLA (eski
            // PR'larını bozma). parseSnowie'nin >100 korumasıyla çift emniyet.
            $first = $rows->first();
            if ((int) $first->match_length <= 1 && (int) $first->stake > 0) {
                $skip++;

                continue;
            }
            $res = $svc->analyzeMat((string) $first->matText());
            if ($res === null) {
                $skip++;

                continue;
            }
            [$p1, $p2, $pr1, $pr2] = $res;
            // POZİSYON eşleme: matText whiteName'i player1 yapar -> .mat p1=white, p2=black.
            // İsimle eşlemeye gerek yok (bot/silinmiş kullanıcıda da doğru).
            $prByUid = [];
            foreach ($rows as $r) {
                $hc = $r->analysisHc();
                if ($hc === 'white') {
                    $prByUid[$r->user_id] = $pr1;
                } elseif ($hc === 'black') {
                    $prByUid[$r->user_id] = $pr2;
                }
            }
            if (count($prByUid) < $rows->count()) {
                $skip++;
                $this->line("  ? hc eşleşmedi: $rc");

                continue;
            }
            if ($apply) {
                foreach ($rows as $r) {
                    // white=p1, black=p2 (bkz matText); rakip = diğer renk (bot maçında da doğru).
                    $white = $r->analysisHc() === 'white';
                    $self = $white ? $pr1 : $pr2;
                    $opp = $white ? $pr2 : $pr1;
                    MatchResult::where('id', $r->id)->update([
                        'gnubg_pr' => $self,
                        'pr' => $self,
                        'gnubg_opponent_pr' => $opp,
                        'opponent_pr' => $opp,
                    ]);
                }
            }
            $done++;
            if ($done % 25 === 0) {
                $rate = $done / max(0.001, microtime(true) - $start);
                $this->line(sprintf('  %d oda | %.2f oda/sn', $done, $rate));
            }
        }
        $dur = microtime(true) - $start;
        $this->info(sprintf('Bitti: %d oda | atlandı %d | %.1f sn | %.2f oda/sn', $done, $skip, $dur, $done / max(0.001, $dur)));

        return self::SUCCESS;
    }
}
