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

    // NOT: COOP artik middleware'de DEGIL, nginx additional directives'te tek kaynaktan verilir
    // (coklu katman COOP'u tarayicida gecersiz kilip GSI postMessage uyarisi doguruyordu). Bu
    // yuzden COOP birim testi kaldirildi; dogrulama canli 'curl -D' ile yapilir.

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

    public function test_csp_report_endpoint_accepts_violation_and_is_best_effort(): void
    {
        // Gecerli ihlal raporu -> 204 (toplandi).
        $this->postJson('/api/csp-report', ['csp-report' => [
            'violated-directive' => 'script-src',
            'blocked-uri' => 'https://evil.example/x.js',
            'document-uri' => 'https://tavlatv.com/online-tavla',
        ]])->assertNoContent();

        // Bozuk/bos govde -> yine 204 (best-effort, akisi bozmaz).
        $this->call('POST', '/api/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], 'not-json')
            ->assertNoContent();
    }
}
