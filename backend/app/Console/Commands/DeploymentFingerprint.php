<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
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
        $this->line('queue_connection='.config('queue.default'));
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
}
