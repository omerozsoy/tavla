<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditWalletReferencesTest extends TestCase
{
    use RefreshDatabase;

    public function test_wallet_reference_audit_is_read_only_and_reports_missing_references(): void
    {
        if (! Schema::hasTable('wallet_transactions')) {
            $this->markTestSkipped('Wallet ledger migration is unavailable.');
        }

        $this->artisan('security:wallet-references')
            ->expectsOutput('wallet_transactions_table=present')
            ->expectsOutput('idempotency_key_column=present')
            ->expectsOutput('missing_reference_total=0')
            ->assertExitCode(0);
    }
}
