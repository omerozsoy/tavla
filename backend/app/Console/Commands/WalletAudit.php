<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\WalletBreakdown;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * TÜM kullanıcıların coin bakiyesini defterle (wallet_transactions) karşılaştırır ve
 * "izahı olmayan para" (defter dışı eklenen/çıkarılan coin) olan hesapları listeler.
 *
 * Kullanım:
 *   php artisan tavla:wallet-audit            # sadece tutarsız hesapları göster
 *   php artisan tavla:wallet-audit --all      # herkesi göster (temizler dahil)
 */
class WalletAudit extends Command
{
    protected $signature = 'tavla:wallet-audit {--all : Tutarlı hesapları da listele}';

    protected $description = 'Bakiye ↔ coin defteri tutarlılığını tarar; izahı olmayan parayı raporlar.';

    public function handle(): int
    {
        if (! Schema::hasTable('wallet_transactions')) {
            $this->error('wallet_transactions tablosu yok; denetim yapılamaz.');

            return self::FAILURE;
        }

        $flagged = [];
        $scanned = 0;

        User::query()->select(['id', 'nickname', 'coins'])->chunkById(200, function ($users) use (&$flagged, &$scanned) {
            foreach ($users as $u) {
                $scanned++;
                $r = WalletBreakdown::quickRecon((int) $u->id, (int) ($u->coins ?? 0));
                if (! $r['clean']) {
                    $flagged[] = [$u, $r];
                }
                if ($this->option('all') && $r['clean']) {
                    $this->line(sprintf('  ✓ #%d %s — %s coin (tutarlı)', $u->id, $u->nickname, number_format((int) $u->coins, 0, ',', '.')));
                }
            }
        });

        $this->newLine();
        if (empty($flagged)) {
            $this->info("Tarandı: {$scanned} hesap. İzahı olmayan para YOK — hepsi defterle tutarlı. ✓");

            return self::SUCCESS;
        }

        $this->warn('İZAHI OLMAYAN PARA / TUTARSIZLIK bulunan hesaplar:');
        $this->table(
            ['#', 'Takma ad', 'Bakiye', 'Defter beklenen', 'İzahsız fark', 'Sorun'],
            collect($flagged)->map(function ($row) {
                [$u, $r] = $row;
                $problems = [];
                if (! $r['balance_ok']) {
                    $problems[] = 'defter dışı bakiye';
                }
                if (! $r['internal_ok']) {
                    $problems[] = 'defter zinciri kırık';
                }

                return [
                    $u->id,
                    $u->nickname,
                    number_format((int) $u->coins, 0, ',', '.'),
                    number_format($r['expected'], 0, ',', '.'),
                    sprintf('%+d', $r['unexplained']),
                    implode(' + ', $problems),
                ];
            })->all()
        );
        $this->error(sprintf('Tarandı: %d hesap · %d tutarsız.', $scanned, count($flagged)));

        return self::SUCCESS;
    }
}
