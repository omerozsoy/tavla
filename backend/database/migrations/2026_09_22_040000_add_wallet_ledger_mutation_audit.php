<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('wallet_transactions')) {
            return;
        }

        $duplicates = DB::table('wallet_transactions')
            ->select('transaction_id')
            ->whereNotNull('transaction_id')
            ->groupBy('transaction_id')
            ->havingRaw('COUNT(*) > 1')
            ->count();
        if ($duplicates > 0) {
            throw new RuntimeException("wallet_transactions contains {$duplicates} duplicate transaction_id group(s)");
        }

        if (! $this->hasUniqueTransactionIdIndex()) {
            Schema::table('wallet_transactions', function (Blueprint $table): void {
                $table->unique('transaction_id', 'wallet_transactions_transaction_id_unique');
            });
        }

        $driver = DB::connection()->getDriverName();
        if ($driver !== 'mysql') {
            return;
        }

        if (! Schema::hasTable('wallet_transaction_mutations')) {
            Schema::create('wallet_transaction_mutations', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('wallet_transaction_id')->nullable();
                $table->string('operation', 12);
                $table->uuid('old_transaction_id')->nullable();
                $table->uuid('new_transaction_id')->nullable();
                $table->unsignedBigInteger('old_user_id')->nullable();
                $table->unsignedBigInteger('new_user_id')->nullable();
                $table->bigInteger('old_amount')->nullable();
                $table->bigInteger('new_amount')->nullable();
                $table->unsignedBigInteger('old_balance_before')->nullable();
                $table->unsignedBigInteger('new_balance_before')->nullable();
                $table->unsignedBigInteger('old_balance_after')->nullable();
                $table->unsignedBigInteger('new_balance_after')->nullable();
                $table->string('db_actor', 191)->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['wallet_transaction_id', 'created_at']);
                $table->index(['operation', 'created_at']);
            });
        }

        if (! $this->hasTrigger('wallet_transactions_audit_update')) {
            DB::unprepared(<<<'SQL'
CREATE TRIGGER wallet_transactions_audit_update
BEFORE UPDATE ON wallet_transactions
FOR EACH ROW
BEGIN
  INSERT INTO wallet_transaction_mutations
    (wallet_transaction_id, operation, old_transaction_id, new_transaction_id,
     old_user_id, new_user_id, old_amount, new_amount,
     old_balance_before, new_balance_before, old_balance_after, new_balance_after, db_actor)
  VALUES
    (OLD.id, 'UPDATE', OLD.transaction_id, NEW.transaction_id,
     OLD.user_id, NEW.user_id, OLD.amount, NEW.amount,
     OLD.balance_before, NEW.balance_before, OLD.balance_after, NEW.balance_after, CURRENT_USER());
END
SQL);
        }

        if (! $this->hasTrigger('wallet_transactions_audit_delete')) {
            DB::unprepared(<<<'SQL'
CREATE TRIGGER wallet_transactions_audit_delete
BEFORE DELETE ON wallet_transactions
FOR EACH ROW
BEGIN
  INSERT INTO wallet_transaction_mutations
    (wallet_transaction_id, operation, old_transaction_id,
     old_user_id, old_amount, old_balance_before, old_balance_after, db_actor)
  VALUES
    (OLD.id, 'DELETE', OLD.transaction_id,
     OLD.user_id, OLD.amount, OLD.balance_before, OLD.balance_after, CURRENT_USER());
END
SQL);
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::unprepared('DROP TRIGGER IF EXISTS wallet_transactions_audit_update');
            DB::unprepared('DROP TRIGGER IF EXISTS wallet_transactions_audit_delete');
            Schema::dropIfExists('wallet_transaction_mutations');
        }

        if (Schema::hasTable('wallet_transactions') && $this->hasNamedIndex('wallet_transactions_transaction_id_unique')) {
            Schema::table('wallet_transactions', function (Blueprint $table): void {
                $table->dropUnique('wallet_transactions_transaction_id_unique');
            });
        }
    }

    private function hasUniqueTransactionIdIndex(): bool
    {
        return $this->hasUniqueIndexOnColumn('transaction_id');
    }

    // SÜRÜCÜ-BAĞIMSIZ index tespiti. Eski sürüm yalnız MySQL 'SHOW INDEX' kullanıyordu; SQLite/PgSQL'de
    // (test :memory: dahil) bu fırlatıp false dönüyor -> migration transaction_id unique'ini TEKRAR
    // yaratmaya çalışıyor ama create-table migration'ı (->unique()) zaten yaratmış -> "index already
    // exists" ve TÜM feature test suite'i (RefreshDatabase) çöküyor. Her sürücüde doğru tespit et.
    private function hasUniqueIndexOnColumn(string $column): bool
    {
        $driver = DB::connection()->getDriverName();
        try {
            if ($driver === 'sqlite') {
                foreach (DB::select("PRAGMA index_list('wallet_transactions')") as $idx) {
                    if ((int) ($idx->unique ?? 0) !== 1) {
                        continue;
                    }
                    foreach (DB::select('PRAGMA index_info('.DB::getPdo()->quote($idx->name).')') as $col) {
                        if (($col->name ?? null) === $column) {
                            return true;
                        }
                    }
                }

                return false;
            }
            if ($driver === 'pgsql') {
                foreach (DB::select("SELECT indexdef FROM pg_indexes WHERE tablename = 'wallet_transactions'") as $row) {
                    $def = (string) ($row->indexdef ?? '');
                    if (stripos($def, 'unique') !== false && str_contains($def, '('.$column.')')) {
                        return true;
                    }
                }

                return false;
            }
            // mysql / mariadb
            foreach (DB::select('SHOW INDEX FROM wallet_transactions WHERE Column_name = ?', [$column]) as $row) {
                if ((int) ($row->Non_unique ?? 1) === 0) {
                    return true;
                }
            }
        } catch (Throwable) {
            return false;
        }

        return false;
    }

    private function hasNamedIndex(string $name): bool
    {
        $driver = DB::connection()->getDriverName();
        try {
            if ($driver === 'sqlite') {
                foreach (DB::select("PRAGMA index_list('wallet_transactions')") as $idx) {
                    if (($idx->name ?? null) === $name) {
                        return true;
                    }
                }

                return false;
            }
            if ($driver === 'pgsql') {
                return DB::table('pg_indexes')->where('tablename', 'wallet_transactions')->where('indexname', $name)->exists();
            }
            foreach (DB::select('SHOW INDEX FROM wallet_transactions') as $row) {
                if (($row->Key_name ?? null) === $name) {
                    return true;
                }
            }
        } catch (Throwable) {
            return false;
        }

        return false;
    }

    private function hasTrigger(string $name): bool
    {
        try {
            return DB::table('information_schema.triggers')
                ->whereRaw('trigger_schema = database()')
                ->where('trigger_name', $name)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }
};
