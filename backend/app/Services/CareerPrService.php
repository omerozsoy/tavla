<?php

namespace App\Services;

use App\Models\MatchResult;
use App\Models\Setting;
use App\Models\User;
use App\Support\PrPool;
use Illuminate\Support\Facades\DB;

/**
 * Career PR (PR Sıralaması) — oyuncunun TÜM geçerli maçlarini TEK büyük analiz seti gibi
 * degerlendiren havuzlanmis PR. Match PR'larinin ortalamasi DEGILDIR:
 *
 *   career_pr = (Σ pr_equity_lost / Σ pr_decisions) × 1000
 *
 * SNOWIE/XG konvansiyonu: Aşama 1'den sonra maç pr_equity_lost = genel hata EMG, pr_decisions =
 * Snowie paydası (tüm hamle + küp kararı). gnubg "Snowie error rate" = err/dec × 1000 (XG-birebir).
 * Kariyer bunları doğrudan havuzlar -> maç Snowie'leriyle AYNI ölçek (karar-agirlikli). Dusuk daha iyi.
 * Dahil: gerçek (match_type!=ai) + insan/online (room_code dolu) + analiz edilmis (pr_decisions>=MIN).
 *
 * Performans: users tablosunda aggregate cache tutulur (career_pr, *_matches, *_decisions,
 * *_equity_lost). Yeni maç raporlaninca ilgili oyuncu icin recalc() (tek gruplu sorgu) çalisir;
 * leaderboard binlerce maçi baştan okumaz. recalcAll() ile toplu yeniden kurulabilir.
 */
class CareerPrService
{
    public const SCALE = 1000; // SNOWIE/XG ölçeği: err/dec × 1000 (gnubg "Snowie error rate" ile birebir).
    // (Aşama 2: 500 -> 1000. Maç PR'ları artık gnubg Snowie; kariyer de aynı ölçekte havuzlanır.)

    // Kariyer küp PR'ı yalnız bu kadar küp kararı birikince anlamlı (altında "—"/gizli).
    public const MIN_CAREER_CUBE_DECISIONS = 25;

    /** Career PR hesabina dahil maçlarin sorgusu (tek kaynak). */
    public function eligibleMatches(int $userId)
    {
        return MatchResult::where('user_id', $userId)
            ->real()                          // yapay zeka (match_type='ai') HARIÇ
            ->whereNotNull('room_code')       // insan/online maç -> tüm bot (pvb) maçlari HARIÇ
            // MİN-KARAR KAPISI: < MIN_PR_DECISIONS kararlı maçlar PR gürültüsü (2-3 kararda 300+) ->
            // career toplamına GİRMEZ (tek maç ekranında da PR'ları null = "—").
            ->where('pr_decisions', '>=', \App\Services\Analysis\AnalysisOrchestrator::MIN_PR_DECISIONS)
            // HAVUZ kariyer: havuz kaybı hesaplanabilen maçlar — pr_equity_lost (review-yazımı) VEYA
            // otoriter pooled gnubg_pr (fallback: gnubg_pr×pr_decisions/500). gnubg analizi olan maçlar.
            ->where(fn ($q) => $q->whereNotNull('pr_equity_lost')->orWhereNotNull('gnubg_pr'))
            // PUANSIZ maçlar (rated=false: puansız arkadaş odası / friendly 24h limiti aşımı) kariyer PR'a
            // ve PR sıralamasına GİRMEZ; PR'ları yalnız o maçın analizinde görünür. Eski satırlar
            // migration varsayılanıyla rated=true -> geçmiş havuz değişmez.
            ->where('rated', true);
    }

    /** Bir oyuncunun aggregate Career PR degerlerini maçlarindan YENIDEN hesapla + kaydet. */
    public function recalc(User $user): void
    {
        // GENEL (overall) KARİYER PR = XG/gnubg HAVUZLANMIŞ standart: maçların HAVUZ totalleri
        // (pr_equity_lost/pr_decisions = pul+küp, prFromReviewLog'dan) doğrudan toplanır
        // (Σpr_equity_lost / Σpr_decisions × 500) -> maç overall'ı ile AYNI standart. pr_equity_lost
        // null eski satırda otoriter pooled gnubg_pr'dan türet (gnubg_pr × pr_decisions / 500).
        // KARİYER KÜP PR ayrı gösterim (profil kırılımı): Σcube_loss/Σcube_dec ×500, ≥MIN_CAREER_CUBE_DECISIONS.
        // NOT: 'dec' MariaDB'de rezerve kelime -> alias 'decs'.
        $agg = $this->eligibleMatches($user->id)
            ->selectRaw(
                'COALESCE(SUM(COALESCE(pr_equity_lost, gnubg_pr * pr_decisions / '.self::SCALE.')),0) as pool_loss, '
                .'COALESCE(SUM(pr_decisions),0) as decs, COUNT(*) as m, '
                .'COALESCE(SUM(cube_equity_lost),0) as cube_loss, COALESCE(SUM(cube_decisions),0) as cube_decs'
            )
            ->first();

        $poolLoss = (float) ($agg->pool_loss ?? 0);
        $poolDec = (int) ($agg->decs ?? 0); // pr_decisions = havuz (pul+küp) karar sayısı
        $m = (int) ($agg->m ?? 0);
        $cubeLoss = (float) ($agg->cube_loss ?? 0);
        $cubeDec = (int) ($agg->cube_decs ?? 0);

        $pr = $poolDec > 0 ? ($poolLoss / $poolDec) * self::SCALE : null; // havuzlanmış overall kariyer PR

        $cubePr = $cubeDec >= self::MIN_CAREER_CUBE_DECISIONS ? ($cubeLoss / $cubeDec) * self::SCALE : null;

        // $fillable kisitli -> forceFill (bkz filament-user-forcefill).
        $user->forceFill([
            'career_pr' => $pr,
            'career_pr_matches' => $m,
            'career_pr_decisions' => $poolDec,             // havuzlanmış (pul+küp) karar sayısı
            'career_pr_equity_lost' => round($poolLoss, 4), // havuzlanmış toplam equity kaybı
            'career_cube_pr' => $cubePr !== null ? round($cubePr, 2) : null,
            'career_cube_decisions' => $cubeDec,
            'career_cube_equity_lost' => round($cubeLoss, 4),
        ])->save();
    }

    /** TÜM oyuncular icin yeniden kur (chunk -> production'da timeout/memory güvenli). Sayi döner. */
    public function recalcAll(int $chunk = 200): int
    {
        $count = 0;
        User::select(['id'])->chunkById($chunk, function ($users) use (&$count) {
            foreach ($users as $u) {
                $this->recalc($u);
                $count++;
            }
        });

        return $count;
    }

    /**
     * Eski analiz edilmis maçlarda eksik ham totalleri (pr_equity_lost/pr_decisions) log'dan doldur.
     * Yalniz log'u olan ama totali null olan satirlar. Döner: güncellenen satir sayisi.
     */
    public function backfillTotalsFromLog(int $chunk = 500): int
    {
        if (! \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'pr_equity_lost')) {
            return 0;
        }
        $updated = 0;
        MatchResult::whereNull('pr_decisions')
            ->whereNotNull('log')
            ->select(['id', 'log', 'pr'])
            ->chunkById($chunk, function ($rows) use (&$updated) {
                foreach ($rows as $r) {
                    $t = PrPool::totalsFromLog($r->log);
                    if (! $t) {
                        continue;
                    }
                    $patch = [
                        'pr_equity_lost' => $t['loss'],
                        'pr_decisions' => $t['decisions'],
                    ];
                    if ($r->pr === null) {
                        $patch['pr'] = round(($t['loss'] / $t['decisions']) * self::SCALE, 2);
                    }
                    DB::table('match_results')->where('id', $r->id)->update($patch);
                    $updated++;
                }
            });

        return $updated;
    }

    /** PR Sıralamasi minimum esikleri (admin: Site Ayarlari). */
    public static function minMatches(): int
    {
        return Setting::int('pr_min_matches', 5);
    }

    public static function minDecisions(): int
    {
        return Setting::int('pr_min_decisions', 100);
    }
}
