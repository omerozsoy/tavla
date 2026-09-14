<?php

namespace Tests\Feature;

use App\Models\MenuGroup;
use App\Models\MenuItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Sol menu grup yonetimi: katalog seed + menu-config'in item.group ve groups dondurmesi +
// syncCatalog'in admin grup atamasini EZMEMESI.
class MenuGroupTest extends TestCase
{
    use RefreshDatabase;

    public function test_menu_config_returns_items_with_group_and_groups(): void
    {
        MenuItem::syncCatalog();
        MenuGroup::syncCatalog();

        $res = $this->getJson('/api/menu-config')->assertOk();

        // Item'larda group alani var.
        $items = $res->json('items');
        $this->assertNotEmpty($items);
        $this->assertArrayHasKey('group', $items[0]);

        // Gruplar dondu ve bilinen anahtarlari iceriyor.
        $groupKeys = collect($res->json('groups'))->pluck('key')->all();
        $this->assertContains('play', $groupKeys);
        $this->assertContains('compete', $groupKeys);
        $this->assertContains('fun', $groupKeys);
    }

    public function test_group_catalog_seed_is_idempotent(): void
    {
        MenuGroup::syncCatalog();
        $count = MenuGroup::count();
        MenuGroup::syncCatalog(); // ikinci kez -> yeni satir olusmaz
        $this->assertSame($count, MenuGroup::count());
        $this->assertGreaterThanOrEqual(6, $count); // en az 6 varsayilan grup
    }

    public function test_syncCatalog_preserves_admin_group_assignment(): void
    {
        MenuItem::syncCatalog();
        // Admin bir ogeyi baska gruba tasidi.
        $item = MenuItem::where('key', 'tournaments')->first();
        $this->assertNotNull($item);
        $item->update(['group' => 'fun']);

        // Menu yenilenince (syncCatalog) admin atamasi KORUNMALI.
        MenuItem::syncCatalog();
        $this->assertSame('fun', MenuItem::where('key', 'tournaments')->first()->group);
    }

    public function test_empty_group_label_nulls_all_translations(): void
    {
        $g = MenuGroup::create(['key' => 'ozel', 'label_tr' => 'Özel', 'sort' => 9]);
        $g->update(['label_tr' => '']);
        $g->refresh();
        $this->assertNull($g->label_tr);
        $this->assertNull($g->label_en);
    }
}
