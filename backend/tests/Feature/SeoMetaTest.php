<?php

namespace Tests\Feature;

use Tests\TestCase;

class SeoMetaTest extends TestCase
{
    public function test_account_route_is_not_indexable(): void
    {
        $this->get('/giris')
            ->assertOk()
            ->assertSee('name="robots" content="noindex, follow"', false);
    }

    public function test_public_landing_route_remains_indexable(): void
    {
        $this->get('/online-tavla')
            ->assertOk()
            ->assertSee('name="robots" content="index, follow"', false)
            ->assertSee('Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv', false);
    }
}
