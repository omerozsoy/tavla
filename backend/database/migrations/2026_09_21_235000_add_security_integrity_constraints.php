<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Database-level invariants for money rooms and the append-only wallet ledger.
 *
 * This migration deliberately refuses to apply while existing rows violate an
 * invariant. It never silently deletes or rewrites production data.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->assertCleanData();

        if (Schema::hasTable('rooms')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->index(['p1_user_id', 'status'], 'rooms_p1_user_status_idx');
                $table->index(['p2_user_id', 'status'], 'rooms_p2_user_status_idx');
            });
        }

        $driver = DB::connection()->getDriverName();
        if (Schema::hasTable('rooms') && $this->supportsCheckConstraints($driver)) {
            $this->addCheck('rooms', 'rooms_distinct_players_chk',
                '(p1_user_id IS NULL OR p2_user_id IS NULL OR p1_user_id <> p2_user_id)');
            $this->addCheck('rooms', 'rooms_settled_terminal_chk',
                "(settled = 0 OR status = 'finished')");
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'coins_reserved')
            && $this->supportsCheckConstraints($driver)) {
            $this->addCheck('users', 'users_reserved_not_above_balance_chk',
                '(coins_reserved <= coins)');
        }

        if (Schema::hasTable('wallet_transactions') && $this->supportsCheckConstraints($driver)) {
            $this->addCheck('wallet_transactions', 'wallet_balance_math_chk',
                '(balance_after = balance_before + amount)');
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        if ($this->supportsCheckConstraints($driver)) {
            foreach ([
                ['rooms', 'rooms_distinct_players_chk'],
                ['rooms', 'rooms_settled_terminal_chk'],
                ['users', 'users_reserved_not_above_balance_chk'],
                ['wallet_transactions', 'wallet_balance_math_chk'],
            ] as [$table, $name]) {
                if (Schema::hasTable($table)) {
                    $this->dropCheck($table, $name, $driver);
                }
            }
        }

        if (Schema::hasTable('rooms')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->dropIndex('rooms_p1_user_status_idx');
                $table->dropIndex('rooms_p2_user_status_idx');
            });
        }
    }

    private function assertCleanData(): void
    {
        if (Schema::hasTable('rooms')) {
            $duplicatePlayers = DB::table('rooms')
                ->whereNotNull('p1_user_id')->whereColumn('p1_user_id', 'p2_user_id')->count();
            if ($duplicatePlayers > 0) {
                throw new RuntimeException("rooms contains {$duplicatePlayers} row(s) where p1_user_id equals p2_user_id");
            }

            $settledNonTerminal = DB::table('rooms')
                ->where('settled', true)->where('status', '!=', 'finished')->count();
            if ($settledNonTerminal > 0) {
                throw new RuntimeException("rooms contains {$settledNonTerminal} settled non-finished row(s)");
            }
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'coins_reserved')) {
            $invalidReservations = DB::table('users')
                ->whereColumn('coins_reserved', '>', 'coins')->count();
            if ($invalidReservations > 0) {
                throw new RuntimeException("users contains {$invalidReservations} row(s) with coins_reserved greater than coins");
            }
        }

        if (Schema::hasTable('wallet_transactions')) {
            $invalidLedgerRows = DB::table('wallet_transactions')
                ->whereRaw('balance_after <> balance_before + amount')->count();
            if ($invalidLedgerRows > 0) {
                throw new RuntimeException("wallet_transactions contains {$invalidLedgerRows} row(s) with invalid balance arithmetic");
            }
        }
    }

    private function supportsCheckConstraints(string $driver): bool
    {
        // SQLite cannot ALTER TABLE to add a named CHECK constraint. The
        // application invariants remain covered by the row-locking services
        // in SQLite test databases; production MySQL/PostgreSQL gets DB checks.
        return in_array($driver, ['mysql', 'pgsql'], true);
    }

    private function addCheck(string $table, string $name, string $expression): void
    {
        DB::statement(sprintf('ALTER TABLE %s ADD CONSTRAINT %s CHECK %s', $table, $name, $expression));
    }

    private function dropCheck(string $table, string $name, string $driver): void
    {
        if ($driver === 'mysql') {
            DB::statement(sprintf('ALTER TABLE %s DROP CHECK %s', $table, $name));
        } elseif ($driver === 'pgsql') {
            DB::statement(sprintf('ALTER TABLE %s DROP CONSTRAINT %s', $table, $name));
        }
        // SQLite cannot drop a CHECK constraint without rebuilding the table.
        // The migration remains safely reversible by restoring the table through
        // the normal migration rollback procedure on SQLite test databases.
    }
};
