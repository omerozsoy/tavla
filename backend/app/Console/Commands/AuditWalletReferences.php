<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Read-only inventory of wallet ledger rows without a business reference. */
class AuditWalletReferences extends Command
{
    protected $signature = 'security:wallet-references';

    protected $description = 'Read-only audit of wallet transactions missing a business reference.';

    public function handle(): int
    {
        if (! Schema::hasTable('wallet_transactions')) {
            $this->line('wallet_transactions_table=missing');
            return self::FAILURE;
        }

        $hasIdempotencyColumn = Schema::hasColumn('wallet_transactions', 'idempotency_key');
        $rows = DB::table('wallet_transactions')
            ->where(function ($query): void {
                $query->whereNull('reference_type')->orWhereNull('reference_id');
            })
            ->select('type', DB::raw('COUNT(*) as total'))
            ->groupBy('type')
            ->orderBy('type')
            ->get();

        $total = (int) $rows->sum('total');
        $this->line('wallet_transactions_table=present');
        $this->line('idempotency_key_column='.($hasIdempotencyColumn ? 'present' : 'missing'));
        $this->line('missing_reference_total='.$total);
        if ($hasIdempotencyColumn) {
            $missingKeyQuery = DB::table('wallet_transactions')->whereNull('idempotency_key');
            $missingKeys = (int) (clone $missingKeyQuery)->count();
            $this->line('missing_idempotency_key='.$missingKeys);
            $recentMissingKeys = (int) (clone $missingKeyQuery)
                ->where('created_at', '>=', now()->subDay())
                ->count();
            $this->line('missing_idempotency_key_last_24h='.$recentMissingKeys);
            $missingKeyTypes = (clone $missingKeyQuery)
                ->select('type', DB::raw('COUNT(*) as total'))
                ->groupBy('type')
                ->orderBy('type')
                ->get();
            foreach ($missingKeyTypes as $row) {
                $this->line('missing_idempotency_type='.$row->type.' count='.(int) $row->total);
            }
        }
        foreach ($rows as $row) {
            $this->line('missing_reference_type='.$row->type.' count='.(int) $row->total);
        }

        // Inventory only: existing historical rows are not modified or failed over.
        return self::SUCCESS;
    }
}
