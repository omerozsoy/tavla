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

    /** Career PR hesabina dahil maçlarin sorgusu (tek kaynak). */
    public function eligibleMatches(int $userId)
    {
        return MatchResult::where('user_id', $userId)
            ->real()                          // yapay zeka (match_type='ai') HARIÇ
            ->whereNotNull('room_code')       // insan/online maç -> tüm bot (pvb) maçlari HARIÇ
            ->where('pr_decisions', '>', 0)   // analiz edilmis + sayilan karar var
            ->whereNotNull('pr_equity_lost');
    }

    /** Bir oyuncunun aggregate Career PR degerlerini maçlarindan YENIDEN hesapla + kaydet. */
    public function recalc(User $user): void
    {
        $agg = $this->eligibleMatches($user->id)
            ->selectRaw('COALESCE(SUM(pr_equity_lost),0) as loss, COALESCE(SUM(pr_decisions),0) as dec, COUNT(*) as m')
            ->first();

        $loss = (float) ($agg->loss ?? 0);
        $dec = (int) ($agg->dec ?? 0);
        $m = (int) ($agg->m ?? 0);
        $pr = $dec > 0 ? ($loss / $dec) * self::SCALE : null;

        // $fillable kisitli -> forceFill (bkz filament-user-forcefill).
        $user->forceFill([
            'career_pr' => $pr,
            'career_pr_matches' => $m,
            'career_pr_decisions' => $dec,
            'career_pr_equity_lost' => $loss,
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
        return Setting::int('pr_min_matches', 10);
    }

    public static function minDecisions(): int
    {
        return Setting::int('pr_min_decisions', 500);
    }
}
