<?php

namespace App\Console\Commands;

use App\Support\CheatScan as Scan;
use App\Support\Shield;
use Illuminate\Console\Command;

/**
 * Motor-yardımı hile taraması. Read-only rapor (AuditTimeoutAfk deseni); --flag ile şüpheli
 * hesaplara Shield audit olayı yazar (mutasyon, opt-in). Günlük scheduler'dan çalışır.
 */
class CheatScan extends Command
{
    protected $signature = 'security:cheat-scan {--user= : Tek kullanıcının şüpheli maçlarını dök}
                                                 {--flag : Şüpheli hesaplara Shield audit olayı yaz (mutasyon)}
                                                 {--min-flags=2 : --flag için en az bu kadar flag olan hesabı işaretle}';

    protected $description = 'Scan match PR history for engine-assist (cheat) signals. Read-only unless --flag.';

    public function handle(): int
    {
        if ($this->option('user') !== null) {
            return $this->dumpUser((int) $this->option('user'));
        }

        $suspects = Scan::suspects();
        $this->line('cheat_scan_suspects='.count($suspects));
        if ($suspects === []) {
            $this->line('cheat_scan_result=CLEAN');

            return self::SUCCESS;
        }

        $this->table(
            ['id', 'nickname', 'rating', 'medyan_pr', 'flag', 'en_kötü_pr', 'banlı'],
            array_map(fn ($s) => [
                $s['user_id'], $s['nickname'], $s['rating'] ?? '-',
                $s['median'], $s['flags'], $s['worst_pr'], $s['banned'] ? 'E' : '-',
            ], $suspects),
        );

        if ($this->option('flag')) {
            $min = max(1, (int) $this->option('min-flags'));
            $marked = 0;
            foreach ($suspects as $s) {
                if ($s['flags'] < $min || $s['banned']) {
                    continue;
                }
                Shield::audit(
                    null,
                    'cheat_suspect',
                    "Motor-yardımı şüphesi: {$s['nickname']} (#{$s['user_id']}) — {$s['flags']} flag, en kötü PR {$s['worst_pr']}, medyan {$s['median']}",
                    3,
                );
                $marked++;
            }
            $this->line('cheat_scan_flagged='.$marked);
        }

        Scan::forget(); // panel rozeti bir sonraki okumada taze suspect kümesini görsün
        $this->line('cheat_scan_result=SUSPECTS');

        return self::SUCCESS;
    }

    private function dumpUser(int $userId): int
    {
        $rows = Scan::flaggedMatches($userId);
        $this->line("user={$userId} flagged_matches=".count($rows));
        if ($rows === []) {
            return self::SUCCESS;
        }
        $this->table(
            ['oda', 'pr', 'checker', 'karar', 'uzunl', 'snç', 'rakip', 'oPR', 'medyan', 'sebep', 'tarih'],
            array_map(fn ($r) => [
                $r['room_code'], $r['pr'], $r['checker_pr'],
                $r['decisions'].'+'.$r['cube_decisions'].'c', $r['match_length'] ?? '-',
                $r['won'] ? 'W' : 'L', mb_substr((string) $r['opponent_name'], 0, 16),
                $r['opponent_pr'], $r['median'], $r['reason'], substr((string) $r['created_at'], 0, 10),
            ], $rows),
        );

        return self::SUCCESS;
    }
}
