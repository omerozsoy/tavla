<?php

namespace Tests\Feature;

use App\Models\EntryPopup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Giriş Kare Banner" halka acik uc noktasi (/api/entry-popup): yayindaki + gorselli ILK
 * kayit doner; yoksa null. Yayin disi / gorselsiz kayitlar gosterilmez.
 */
class EntryPopupTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_null_when_none_published(): void
    {
        EntryPopup::create(['image' => 'reklam/a.png', 'published' => false]);
        EntryPopup::create(['image' => null, 'published' => true]);

        $this->getJson('/api/entry-popup')->assertOk()->assertJsonPath('popup', null);
    }

    public function test_returns_first_published_with_fields(): void
    {
        // sort ile: kucuk once. Ilk yayindaki gorselli kayit doner.
        EntryPopup::create(['image' => 'reklam/b.png', 'link' => 'https://x.test', 'frequency' => 'daily', 'audience' => 'guest', 'sort' => 5, 'published' => true]);
        $first = EntryPopup::create(['image' => 'reklam/a.png', 'frequency' => 'session', 'audience' => 'all', 'sort' => 1, 'published' => true]);

        $this->getJson('/api/entry-popup')->assertOk()
            ->assertJsonPath('popup.id', $first->id)
            ->assertJsonPath('popup.image', 'reklam/a.png')
            ->assertJsonPath('popup.frequency', 'session')
            ->assertJsonPath('popup.audience', 'all');
    }
}
