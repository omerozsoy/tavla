<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Read-only evidence for database-level wallet ledger integrity. */
class AuditWalletIntegrity extends Command
{
    protected $signature = 'security:wallet-integrity-audit';

    protected $description = 'Audit wallet ledger checks, uniqueness and append-only database protection.';

    public function handle(): int
    {
        if (! Schema::hasTable('wallet_transactions')) {
            $this->line('wallet_transactions_table=missing');
            $this->line('wallet_integrity_result=UNKNOWN');
            return self::SUCCESS;
        }

        $this->line('wallet_transactions_table=present');
        $this->line('balance_math_check='.$this->constraintPresence('wallet_balance_math_chk'));
        $this->line('append_only_update_triggers='.$this->triggerCount('UPDATE'));
        $this->line('append_only_delete_triggers='.$this->triggerCount('DELETE'));
        $this->line('transaction_id_unique='.$this->indexPresence('transaction_id'));
        $this->line('mutation_audit_table='.(Schema::hasTable('wallet_transaction_mutations') ? 'present' : 'missing'));
        $this->line('wallet_integrity_result='.$this->result());

        return self::SUCCESS;
    }

    private function result(): string
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'pgsql'], true)) {
            return 'UNKNOWN';
        }

        return $this->triggerCount('UPDATE') > 0 && $this->triggerCount('DELETE') > 0
            && Schema::hasTable('wallet_transaction_mutations')
            && $this->indexPresence('transaction_id') === 'present'
            ? 'PASS'
            : 'PARTIAL';
    }

    private function constraintPresence(string $name): string
    {
        try {
            $count = DB::table('information_schema.table_constraints')
                ->whereRaw('constraint_schema = database()')
                ->where('table_name', 'wallet_transactions')
                ->where('constraint_name', $name)
                ->count();
            return $count > 0 ? 'present' : 'missing';
        } catch (\Throwable) {
            return 'unknown';
        }
    }

    private function triggerCount(string $event): int|string
    {
        try {
            return (int) DB::table('information_schema.triggers')
                ->whereRaw('trigger_schema = database()')
                ->where('event_object_table', 'wallet_transactions')
                ->where('event_manipulation', $event)
                ->count();
        } catch (\Throwable) {
            return 'unknown';
        }
    }

    private function indexPresence(string $column): string
    {
        try {
            $rows = DB::select('SHOW INDEX FROM wallet_transactions WHERE Column_name = ?', [$column]);
            foreach ($rows as $row) {
                if ((int) ($row->Non_unique ?? 1) === 0) {
                    return 'present';
                }
            }
            return 'missing';
        } catch (\Throwable) {
            return 'unknown';
        }
    }
}
