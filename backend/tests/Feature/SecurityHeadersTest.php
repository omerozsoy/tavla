<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_permissions_policy_is_always_present(): void
    {
        $this->get('/up')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }

    public function test_coop_allows_popups_for_google_sign_in(): void
    {
        // GSI popup/iframe window.postMessage'i bloklanmasin diye same-origin-allow-popups sart.
        $this->get('/up')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    }

    public function test_csp_report_only_is_opt_in(): void
    {
        config()->set('security.csp_report_only', true);

        $this->get('/up')
            ->assertHeader('Content-Security-Policy-Report-Only');
    }

    public function test_csp_enforcing_is_opt_in(): void
    {
        config()->set('security.csp_enforce', true);

        $this->get('/up')
            ->assertHeader('Content-Security-Policy')
            ->assertHeaderMissing('Content-Security-Policy-Report-Only');
    }
}
