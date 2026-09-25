<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gecmis maclardaki SAHTE 0.00 PR degerlerini temizler (NULL'lar -> ekran "—").
 *
 * KOK SEBEP: Otoriter modda rakibin PR'i kazananin log'undan yeniden kurulan
 * hamlelerle hesaplanir; bu girdiler pos/dice/playedSteps tasimayinca gnubg hicbir
 * pozisyonu skorlayamaz (evaluated=0) ama checkerPr "PR asla null olmasin" geregi
 * 0.0 fallback doner. Bu SAHTE 0.0 kolonlara yazilinca sonuc ekraninda kaybeden
 * "0.00 + Super Grandmaster" (divisionOfPR(0)=en ust seviye) gorunur. AnalyzeMatchPrJob
 * artik yalniz evaluated>0 iken yazar; bu komut ise ONCEDEN yazilmis satirlari duzeltir.
 *
 * Bir insan tam bir macta 0.00 PR (kusursuz oyun) yapamaz -> gnubg_pr / gnubg_opponent_pr
 * / opponent_pr tam olarak 0.00 ise sentinel'dir; NULL yapiyoruz (gnubg tekrar kosarsa
 * gercek deger dolar). Kup PR 0.00 tek basina mesru olabilir -> yalniz ilgili genel PR de
 * 0.00 iken (o taraf komple sentinel) temizlenir.
 *
 * Kullanim (Plesk Artisan kutusu "php artisan" onekini kendi ekler):
 *   tavla:purge-sentinel-zero-pr --dry-run     # sadece say, yazma
 *   tavla:purge-sentinel-zero-pr               # uygula
 *   tavla:purge-sentinel-zero-pr --room=CRD5S  # yalniz bir mac kodu
 *   tavla:purge-sentinel-zero-pr --user=42     # yalniz bir kullanici
 */
class PurgeSentinelZeroPr extends Command
{
    protected $signature = 'tavla:purge-sentinel-zero-pr '
        .'{--dry-run : Sadece say, yazma} '
        .'{--room= : Yalniz bu room_code} '
        .'{--user= : Yalniz bu user_id}';

    protected $description = 'Gecmis maclardaki sahte 0.00 PR degerlerini NULL yapar (0.00+Super GM hatasi)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $room = $this->option('room');
        $user = $this->option('user');

        // Ortak filtre: opsiyonel room_code / user_id kisitlari.
        $scope = function ($q) use ($room, $user) {
            if ($room !== null) {
                $q->where('room_code', $room);
            }
            if ($user !== null) {
                $q->where('user_id', (int) $user);
            }

            return $q;
        };

        $has = fn (string $c) => Schema::hasColumn('match_results', $c);
        $total = 0;

        // --- RAKIP tarafi (online: room_code dolu; reconstruction yalniz online'da) -----------
        // A) gnubg_opponent_pr = 0.00 -> o tarafin uc kovasi da sentinel; hepsini NULL'la.
        if ($has('gnubg_opponent_pr')) {
            $oppCols = array_values(array_filter(
                ['gnubg_opponent_pr', 'gnubg_opponent_checker_pr', 'gnubg_opponent_cube_pr'],
                $has
            ));
            $q = $scope(DB::table('match_results')->whereNotNull('room_code')->where('gnubg_opponent_pr', 0));
            $total += $this->apply($q, 'gnubg_opponent_pr (+checker/cube) = 0.00', $oppCols, $dry);
        }

        // B) opponent_pr (ekranin GERCEKTEN okudugu kolon) = 0.00 -> NULL.
        if ($has('opponent_pr')) {
            $q = $scope(DB::table('match_results')->whereNotNull('room_code')->where('opponent_pr', 0));
            $total += $this->apply($q, 'opponent_pr = 0.00', ['opponent_pr'], $dry);
        }

        // --- KENDI tarafi -------------------------------------------------------------------
        // C) pr (gosterilen/otoriter) = 0.00 VE gnubg_pr = 0.00 -> otoriter sentinel; pr NULL.
        //    (gnubg_pr'i NULL'lamadan ONCE calismali; kosul ona bakiyor.)
        if ($has('pr') && $has('gnubg_pr')) {
            $q = $scope(DB::table('match_results')->where('pr', 0)->where('gnubg_pr', 0));
            $total += $this->apply($q, 'pr = 0.00 (gnubg_pr da 0.00)', ['pr'], $dry);
        }

        // D) gnubg_pr = 0.00 -> kendi uc kovasi + gnubg_pr_at sentinel; hepsini NULL'la.
        if ($has('gnubg_pr')) {
            $selfCols = array_values(array_filter(
                ['gnubg_pr', 'gnubg_checker_pr', 'gnubg_cube_pr', 'gnubg_pr_at'],
                $has
            ));
            $q = $scope(DB::table('match_results')->where('gnubg_pr', 0));
            $total += $this->apply($q, 'gnubg_pr (+checker/cube/at) = 0.00', $selfCols, $dry);
        }

        $this->newLine();
        if ($dry) {
            $this->warn("dry-run: hicbir satir yazilmadi. Toplam ETKILENECEK satir (kova bazli): {$total}");
        } else {
            $this->info("Tamam. Toplam NULL'lanan satir (kova bazli): {$total}");
        }

        return self::SUCCESS;
    }

    /**
     * Bir kovayi (WHERE + hedef kolonlar) uygular veya (dry-run) sayar; adet raporlar.
     *
     * @param  \Illuminate\Database\Query\Builder  $q
     * @param  string[]  $cols
     */
    private function apply($q, string $label, array $cols, bool $dry): int
    {
        if (empty($cols)) {
            return 0;
        }
        $count = (clone $q)->count();
        if ($count === 0) {
            $this->line("  0  {$label}");

            return 0;
        }
        if ($dry) {
            $this->line("  {$count}  {$label}  [dry-run]");

            return $count;
        }
        $q->update(array_fill_keys($cols, null));
        $this->line("  {$count}  {$label}  -> NULL");

        return $count;
    }
}
