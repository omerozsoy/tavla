<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\Analysis\GnubgSnowieService;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * OTORİTER PR = gnubg'nin KENDİ "Snowie error rate"i (XG ile birebir). Review-log equity-toplamı
 * yöntemi match-play'de ~6x şişiyordu (maç 7669 By_tgg: bizim 327, gnubg Snowie 51.4, XG 56.24).
 * Bu job gnubg `/analyzematch`'i çağırır, GnubgSnowieService ile per-oyuncu Snowie PR'ı çıkarır ve
 * odadaki İKİ satıra (self + kardeş) renk-eşlemeli yazar. gnubg_review (hamle-hamle ekran) AYRI kalır
 * (CacheMatchReviewJob yazar); bu yalnız PR kolonlarını otoriter Snowie'ye çeker.
 *
 * BEST-EFFORT (tries=1): gnubg down/başarısız -> sessizce vazgeç (failed_jobs'a düşmez). pr>100 çöp
 * koruması null yazar ("—"). Maç-sonu + backfill (tavla:snowie-pr) buraya yönlenir.
 */
class AnalyzeMatchSnowieJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300; // analyzematch ağır (~saniyeler)

    public function __construct(public int $matchResultId)
    {
        $this->onQueue('reviews');
    }

    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('match-snowie:'.$this->matchResultId))->expireAfter(600)->dontRelease(),
        ];
    }

    public function handle(?GnuBgClient $gnubg = null): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_pr')) {
            return;
        }
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || empty($mr->log) || empty($mr->room_code)) {
            return; // analiz edilecek log yok
        }
        $client = $gnubg ?? app(GnuBgClient::class);
        if (! $client->analyzeHealthy()) {
            return; // gnubg DOWN -> dokunma (backfill/maç-sonu dönünce tekrar dener)
        }
        try {
            $mat = $mr->matText();
        } catch (\Throwable $e) {
            Log::warning('snowie mat-build hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);

            return;
        }
        if (trim((string) $mat) === '') {
            return;
        }
        $res = $client->analyzeMatch($mat, 2);
        $snow = app(GnubgSnowieService::class)->snowieFromAnalyze($res, AnalysisOrchestrator::MIN_CUBE_DECISIONS);
        if ($snow === null) {
            Log::warning('snowie analiz yok/cop (yok sayildi)', ['id' => $mr->id]);

            return; // analiz başarısız / çöp -> MEVCUT değerlere DOKUNMA (bozma)
        }

        try {
            foreach (MatchResult::where('room_code', $mr->room_code)->get() as $row) {
                $hc = $row->analysisHc();
                if (! in_array($hc, ['white', 'black'], true)) {
                    continue;
                }
                // snow[0] = gnubg player0 = white, snow[1] = black. null = pr>100 çöp -> "—".
                $self = $hc === 'white' ? $snow[0] : $snow[1];
                $opp = $hc === 'white' ? $snow[1] : $snow[0];
                $selfPr = is_array($self) ? ($self['pr'] ?? null) : null;
                $oppPr = is_array($opp) ? ($opp['pr'] ?? null) : null;
                // KÖK FIX (kalıcı "—" + kariyer yarılanması): Snowie bir tarafı skorlayamazsa (pr>100 çöp
                // ya da .mat p2/siyah çıkarımı boş -> null) o tarafın PR kolonlarını NULL ile EZME. Eskiden
                // koşulsuz yazılıyordu -> AnalyzeMatchPrJob'ın DOĞRU per-pozisyon değeri silinip mezar taşı
                // konuyordu -> KALICI "—". Artık SALT-EKLEYİCİ: yalnız gerçekten skorlanan taraf yazılır;
                // diğer taraf per-pozisyon değerinde kalır (tekrar eden backfill'in kök nedeni).
                $upd = [];
                if ($selfPr !== null) {
                    $upd['gnubg_pr'] = $selfPr;
                    $upd['pr'] = $selfPr;
                    $upd['gnubg_checker_pr'] = $self['checker_pr'] ?? null;
                    $upd['gnubg_cube_pr'] = $self['cube_pr'] ?? null;
                    $upd['cube_equity_lost'] = $self['cube_equity_lost'] ?? 0; // küp err EMG (kariyer küp PR, Aşama 2)
                    $upd['cube_decisions'] = $self['cube_decisions'] ?? 0;
                    $upd['pr_equity_lost'] = $self['equity_lost'] ?? null;     // kariyer: overall err EMG (Snowie pay)
                    $upd['pr_decisions'] = $self['decisions'] ?? 0;            // kariyer: tüm hamle+küp (Snowie payda)
                    $upd['gnubg_pr_at'] = now();
                }
                if ($oppPr !== null) {
                    $upd['gnubg_opponent_pr'] = $oppPr;
                    $upd['opponent_pr'] = $oppPr;
                    $upd['gnubg_opponent_checker_pr'] = $opp['checker_pr'] ?? null;
                    $upd['gnubg_opponent_cube_pr'] = $opp['cube_pr'] ?? null;
                }
                if ($upd !== []) {
                    MatchResult::where('id', $row->id)->update($upd);
                }
            }
            // RESUMABLE imleç: işlenen odayı damgala -> tavla:snowie-pr re-run bunu atlar.
            if (Schema::hasColumn('match_results', 'pr_shield_at')) {
                MatchResult::where('room_code', $mr->room_code)->update(['pr_shield_at' => now()]);
            }
            Log::info('snowie PR yazildi', ['id' => $mr->id, 'room' => $mr->room_code]);
        } catch (\Throwable $e) {
            Log::warning('snowie PR yazimi hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }
    }
}
