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
    protected $signature = 'tavla:snowie-backfill {--workers=1} {--shard=0} {--limit=0} {--apply} {--money}';

    protected $description = 'Geçmiş PR\'ları gnubg Snowie error rate\'ine çeker (maç-cubeful, küp dahil)';

    public function handle(GnubgSnowieService $svc): int
    {
        $workers = max(1, (int) $this->option('workers'));
        $shard = (int) $this->option('shard');
        $limit = (int) $this->option('limit');
        $apply = (bool) $this->option('apply');
        $moneyOnly = (bool) $this->option('money'); // SADECE money oyunları (money-session .mat ile)

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
            // Money (bahisli, CANLI KÜP) oyunu: matText artık money-session (.mat "0 point match")
            // kurar -> gnubg küpü canlı + gammon sayar (doğru PR). Normal run'da money'yi ATLA
            // (eski davranış); --money run'da SADECE money'yi işle. parseSnowie'nin >100 koruması
            // yine de güvenlik ağı.
            $first = $rows->first();
            $isMoneyRow = (int) $first->match_length <= 1 && (int) $first->stake > 0;
            if ($moneyOnly !== $isMoneyRow) {
                if (! $moneyOnly) {
                    $skip++; // normal run: money atlandı
                }

                continue; // --money run: money-olmayanı sessizce geç
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
                    // TUTARLILIK KALKANI: overall (Snowie) = checker+küp havuzlaması -> kendi
                    // bileşenlerinin ARASINDA olmalı (overall ∈ [min,max]); checker VE küpten yüksek
                    // overall MATEMATİKSEL OLARAK İMKANSIZDIR. Snowie-CLI, terk/timeout gibi bozuk .mat
                    // (buildMat resign'de zar düşürür) yeniden-analizinde ŞİŞMİŞ çöp üretir (ör. 1.1 PR'lık
                    // kusursuz oyuna 88). Böyle değer DOĞRU review-havuz overall'ını EZMESİN -> satırı atla.
                    $chk = $r->gnubg_checker_pr;
                    $cube = $r->gnubg_cube_pr;
                    if ($chk !== null) {
                        $max = max((float) $chk, $cube !== null ? (float) $cube : (float) $chk);
                        if ($self > $max + 2.0) {
                            $this->line(sprintf('  ! imkansiz Snowie atlandi: row#%d self=%.2f > max(checker,cube)=%.2f', $r->id, $self, $max));

                            continue;
                        }
                    }
                    // KÖK FIX (kalıcı "—"): Snowie bir tarafı skorlayamazsa (null) o tarafı NULL ile EZME
                    // -> per-pozisyon değeri korunur. SALT-EKLEYİCİ (bkz CacheMatchReviewJob/AnalyzeMatchSnowieJob).
                    $su = [];
                    if ($self !== null) {
                        $su['gnubg_pr'] = $self;
                        $su['pr'] = $self;
                    }
                    if ($opp !== null) {
                        $su['gnubg_opponent_pr'] = $opp;
                        $su['opponent_pr'] = $opp;
                    }
                    if ($su !== []) {
                        MatchResult::where('id', $r->id)->update($su);
                    }
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
