<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * İSTEMCİ PUSH KAPISI (Belirti 1 "geç" — Reverb etkinleştirme).
 *
 * İstemci (src/online/realtime.ts) Echo'yu YALNIZ `/api/realtime-config` `enabled:true` dönerse kurar;
 * `key` boşsa da kurmaz. Gate = `broadcasting.default === 'reverb'`. Prod `.env`'de
 * BROADCAST_CONNECTION=reverb + REVERB_APP_KEY ayarlanınca push açılır; aksi halde DORMANT (saf poll).
 * SECRET asla dönmez (yalnız public key). Bu test gate'in iki yönünü de kilitler.
 */
class RealtimeConfigTest extends TestCase
{
    public function test_disabled_when_broadcast_connection_not_reverb(): void
    {
        config(['broadcasting.default' => 'log']);

        $this->getJson('/api/realtime-config')
            ->assertOk()
            ->assertJson(['enabled' => false]);
    }

    public function test_enabled_with_public_key_when_reverb_selected(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'pub-key-123',
            'broadcasting.connections.reverb.secret' => 'SECRET-must-not-leak',
        ]);

        $res = $this->getJson('/api/realtime-config')->assertOk();
        $res->assertJson(['enabled' => true, 'key' => 'pub-key-123']);
        // SECRET sızmamalı.
        $this->assertStringNotContainsString('SECRET-must-not-leak', $res->getContent());
    }
}
