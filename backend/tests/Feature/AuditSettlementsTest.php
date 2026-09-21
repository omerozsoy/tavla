<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditSettlementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_read_only_settlement_audit_reports_clean_state(): void
    {
        $this->artisan('security:settlement-audit')
            ->expectsOutput('settled_non_terminal=0')
            ->expectsOutput('duplicate_settlement_refs=0')
            ->assertExitCode(0);
    }
}
