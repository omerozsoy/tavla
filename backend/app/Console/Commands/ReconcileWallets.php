<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class ReconcileWallets extends Command
{
    protected $signature = 'wallet:reconcile {--user= : Only inspect one user ID}';

    protected $description = 'Read-only wallet ledger and balance reconciliation report.';

    public function handle(): int
    {
        if (! Schema::hasTable('wallet_transactions')) {
            $this->error('wallet_transactions table is missing; no reconciliation performed.');
            return self::FAILURE;
        }

        $query = User::query()->select(['id', 'coins', 'coins_reserved']);
        if ($id = $this->option('user')) {
            $query->whereKey((int) $id);
        }

        $checked = 0;
        $drift = 0;
        $query->orderBy('id')->chunkById(500, function ($users) use (&$checked, &$drift) {
            foreach ($users as $user) {
                $sum = (int) WalletTransaction::where('user_id', $user->id)->sum('amount');
                $first = WalletTransaction::where('user_id', $user->id)->orderBy('id')->value('balance_before');
                $expected = $first === null ? $sum : (int) $first + $sum;
                $checked++;
                if ($expected !== (int) $user->coins || (int) $user->coins_reserved > (int) $user->coins) {
                    $drift++;
                    $this->warn(sprintf(
                        'user=%d balance=%d ledger_expected=%d reserved=%d',
                        $user->id, (int) $user->coins, $expected, (int) $user->coins_reserved
                    ));
                }
            }
        });

        $this->info("Checked {$checked} users; drift={$drift}.");
        return $drift === 0 ? self::SUCCESS : self::FAILURE;
    }
}
