<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * KOK FIX regresyonu ("Route [login] not defined" 500leri): auth:sanctum a takilan kimliksiz bir
 * /api/* istegi, Accept: application/json GONDERMESE bile (crawler / link onizleme botu / adres
 * cubuguna yapistirma) 401 JSON donmeli - ASLA route(login) e redirect deneyip RouteNotFoundException
 * (500) atmamali. bkz bootstrap/app.php AuthenticationException render handler.
 */
class ApiUnauthenticatedJsonTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_api_without_json_accept_gets_401_not_500(): void
    {
        // Accept: text/html -> Laravel istegi JSON saymaz; eski davranis login e redirect -> 500 idi.
        $res = $this->get('/api/me/match-pr', ['Accept' => 'text/html']);

        $res->assertStatus(401);
        $res->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_guest_api_with_json_accept_gets_401(): void
    {
        $res = $this->getJson('/api/me/match-pr');

        $res->assertStatus(401);
    }
}