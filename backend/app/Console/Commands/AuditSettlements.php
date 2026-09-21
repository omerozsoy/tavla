<?php

namespace App\Console\Commands;

use App\Models\Room;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Read-only settlement consistency check. */
class AuditSettlements extends Command
{
    protected $signature = 'security:settlement-audit';

    protected $description = 'Read-only audit of settled rooms and wallet settlement references.';

    public function handle(): int
    {
        $settledNonTerminal = Room::query()->where('settled', true)->where('status', '!=', 'finished')->count();
        $duplicateRefs = 0;
        if (Schema::hasTable('wallet_transactions')) {
            $duplicateRefs = DB::table('wallet_transactions')
                ->where('reference_type', Room::class)
                ->whereIn('type', ['match_settlement_debit', 'match_settlement_credit'])
                ->whereNotNull('reference_id')
                ->select('reference_id', 'type', 'user_id')
                ->groupBy('reference_id', 'type', 'user_id')
                ->havingRaw('COUNT(*) > 1')
                ->get()->count();
        }

        $this->line('settled_non_terminal='.$settledNonTerminal);
        $this->line('duplicate_settlement_refs='.$duplicateRefs);

        return ($settledNonTerminal || $duplicateRefs) ? self::FAILURE : self::SUCCESS;
    }
}
