<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/** Read-only production fingerprint; never prints secrets or user balances. */
class DeploymentFingerprint extends Command
{
    protected $signature = 'security:deployment-fingerprint';

    protected $description = 'Print a secret-free deployment and runtime fingerprint.';

    public function handle(): int
    {
        $this->line('app_env='.app()->environment());
        $this->line('app_debug='.(config('app.debug') ? 'true' : 'false'));
        $this->line('php_version='.PHP_VERSION);
        $this->line('framework_version='.app()->version());
        $this->line('config_cached='.((function_exists('app') && app()->configurationIsCached()) ? 'true' : 'false'));
        $this->line('routes_cached='.((function_exists('app') && app()->routesAreCached()) ? 'true' : 'false'));
        $this->line('db_driver='.DB::getDriverName());
        $this->line('db_version='.$this->databaseVersion());
        $this->line('db_transaction_isolation='.$this->transactionIsolation());
        $this->line('queue_connection='.config('queue.default'));
        $failedConnection = (string) config('queue.failed.database', config('database.default'));
        $failedTable = (string) config('queue.failed.table', 'failed_jobs');
        $this->line('failed_jobs_table='.$this->tablePresence($failedConnection, $failedTable));
        $this->line('queue_pending_jobs='.$this->tableCount((string) config('queue.connections.database.table', 'jobs'), (string) config('queue.connections.database.connection', config('database.default'))));
        $this->line('queue_failed_jobs='.$this->tableCount($failedTable, $failedConnection));
        $this->line('queue_heartbeat_age_seconds='.$this->heartbeatAge('queue:worker:heartbeat'));
        $this->line('cron_heartbeat_age_seconds='.$this->heartbeatAge('ops:cron:heartbeat'));
        $this->line('release_sha_present='.(($this->releaseSha() !== null) ? 'true' : 'false'));
        $this->line('validator_url_configured='.(config('validator.url') ? 'true' : 'false'));
        $this->line('validator_backup_configured='.(config('validator.url_backup') ? 'true' : 'false'));
        $this->line('wallet_ledger_table='.(Schema::hasTable('wallet_transactions') ? 'present' : 'missing'));
        $this->line('active_money_claims_table='.(Schema::hasTable('active_money_match_claims') ? 'present' : 'missing'));
        $this->line('latest_migration_batch='.$this->latestMigrationBatch());

        return self::SUCCESS;
    }

    private function databaseVersion(): string
    {
        try {
            return (string) DB::selectOne('select version() as version')->version;
        } catch (\Throwable) {
            return 'unavailable';
        }
    }

    private function latestMigrationBatch(): string
    {
        if (! Schema::hasTable('migrations')) {
            return 'unavailable';
        }
        return (string) (DB::table('migrations')->max('batch') ?? 'none');
    }

    private function transactionIsolation(): string
    {
        try {
            $row = DB::selectOne('select @@transaction_isolation as isolation');
            return (string) ($row->isolation ?? 'unknown');
        } catch (\Throwable) {
            try {
                $row = DB::selectOne('select @@tx_isolation as isolation');
                return (string) ($row->isolation ?? 'unknown');
            } catch (\Throwable) {
                return 'unavailable';
            }
        }
    }

    private function releaseSha(): ?string
    {
        $configured = config('app.release_sha');
        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }
        foreach (['APP_RELEASE_SHA', 'RELEASE_SHA', 'GIT_COMMIT'] as $key) {
            $value = getenv($key);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }
        return null;
    }

    private function tableCount(string $table, ?string $connection = null): string
    {
        $connection ??= config('database.default');
        try {
            if (! DB::connection($connection)->getSchemaBuilder()->hasTable($table)) {
                return 'unavailable';
            }
            return (string) DB::connection($connection)->table($table)->count();
        } catch (\Throwable) {
            return 'unavailable';
        }
    }

    private function tablePresence(string $connection, string $table): string
    {
        try {
            return DB::connection($connection)->getSchemaBuilder()->hasTable($table) ? 'present' : 'missing';
        } catch (\Throwable) {
            return 'unavailable';
        }
    }

    private function heartbeatAge(string $key): string
    {
        $value = Cache::get($key);
        if (! is_numeric($value) || (int) $value <= 0) {
            return 'unknown';
        }
        return (string) max(0, time() - (int) $value);
    }
}
