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
 *   career_pr = (Σ pr_equity_lost / Σ pr_decisions) × 500
 *
 * (match_results.pr ile AYNI matematik; karar-agirlikli -> uzun/çok-kararli maçlar dogal olarak
 * daha agir.) Dusuk deger daha iyidir. Dahil edilen maçlar: gerçek (match_type!=ai) + insan/online
 * (room_code dolu -> bot maçlari HARIÇ) + analiz edilmis (pr_decisions>0, pr_equity_lost dolu).
 *
 * Performans: users tablosunda aggregate cache tutulur (career_pr, *_matches, *_decisions,
 * *_equity_lost). Yeni maç raporlaninca ilgili oyuncu icin recalc() (tek gruplu sorgu) çalisir;
 * leaderboard binlerce maçi baştan okumaz. recalcAll() ile toplu yeniden kurulabilir.
 */
class CareerPrService
{
    public const SCALE = 500; // Match PR ile ayni olcek (bkz AuthController::prFromLog)

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
            ->whereNotNull('gnubg_checker_pr') // checker-only kariyer: checker PR'ı olan maçlar
            // PUANSIZ maçlar (rated=false: puansız arkadaş odası / friendly 24h limiti aşımı) kariyer PR'a
            // ve PR sıralamasına GİRMEZ; PR'ları yalnız o maçın analizinde görünür. Eski satırlar
            // migration varsayılanıyla rated=true -> geçmiş havuz değişmez.
            ->where('rated', true);
    }

    /** Bir oyuncunun aggregate Career PR degerlerini maçlarindan YENIDEN hesapla + kaydet. */
    public function recalc(User $user): void
    {
        // CHECKER-ONLY kariyer PR: genel PR küpsüz (checker) olduğundan kariyer de maçların
        // gnubg_checker_pr'ından KARAR-AĞIRLIKLI ortalanır (gnubg_checker_pr zaten ×500'lü PR değeri).
        // Bu history+future tutarlı + yavaş review-backfill GEREKTİRMEZ (checker PR her maçta saklı).
        // KARİYER KÜP PR: tek maçta anlamsız, ama TÜM maçların küp kaybı/kararı toplanınca anlamlı
        // (Σcube_loss/Σcube_dec ×500). Yeterli küp kararı yoksa (< MIN_CAREER_CUBE_DECISIONS) null.
        // NOT: 'dec' MariaDB'de rezerve kelime -> alias 'decs'.
        $agg = $this->eligibleMatches($user->id)
            ->selectRaw('COALESCE(SUM(gnubg_checker_pr * pr_decisions),0) as wsum, COALESCE(SUM(pr_decisions),0) as decs, COUNT(*) as m, '
                .'COALESCE(SUM(cube_equity_lost),0) as cube_loss, COALESCE(SUM(cube_decisions),0) as cube_decs')
            ->first();

        $wsum = (float) ($agg->wsum ?? 0);
        $dec = (int) ($agg->decs ?? 0);
        $m = (int) ($agg->m ?? 0);
        $pr = $dec > 0 ? ($wsum / $dec) : null; // karar-ağırlıklı checker PR ortalaması

        $cubeLoss = (float) ($agg->cube_loss ?? 0);
        $cubeDec = (int) ($agg->cube_decs ?? 0);
        $cubePr = $cubeDec >= self::MIN_CAREER_CUBE_DECISIONS ? ($cubeLoss / $cubeDec) * self::SCALE : null;

        // $fillable kisitli -> forceFill (bkz filament-user-forcefill).
        $user->forceFill([
            'career_pr' => $pr,
            'career_pr_matches' => $m,
            'career_pr_decisions' => $dec,
            'career_pr_equity_lost' => $wsum / self::SCALE, // yaklaşık checker equity (bilgi)
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
