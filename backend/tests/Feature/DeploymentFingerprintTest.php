<?php

namespace Tests\Feature;

use Tests\TestCase;

class DeploymentFingerprintTest extends TestCase
{
    public function test_fingerprint_is_secret_free_and_reports_runtime_state(): void
    {
        $this->artisan('security:deployment-fingerprint')
            ->expectsOutput('app_env=testing')
            ->expectsOutput('app_debug=true')
            ->expectsOutputToContain('php_version=')
            ->expectsOutputToContain('db_driver=')
            ->expectsOutputToContain('db_transaction_isolation=')
            ->expectsOutputToContain('queue_connection=')
            ->expectsOutputToContain('failed_jobs_table=')
            ->expectsOutputToContain('queue_pending_jobs=')
            ->expectsOutputToContain('queue_heartbeat_age_seconds=')
            ->expectsOutputToContain('cron_heartbeat_age_seconds=')
            ->assertExitCode(0);
    }
}
