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

    public function test_shop_is_in_account_catalog(): void
    {
        // Mağaza sol menüye geri kondu -> katalogda HESAP grubunda satir olusmali,
        // /admin/menu-items ile yonetilebilir olmali (visible varsayilan true).
        MenuItem::syncCatalog();
        $shop = MenuItem::where('key', 'shop')->first();
        $this->assertNotNull($shop);
        $this->assertSame('account', $shop->group);
        $this->assertTrue((bool) $shop->visible);
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

    public function test_collapsed_default_seeds_and_admin_override_flows_to_menu_config(): void
    {
        MenuGroup::syncCatalog();

        // Varsayilan: play/compete ACIK (collapsed=false), fun/content KAPALI (collapsed=true).
        $this->assertFalse((bool) MenuGroup::where('key', 'play')->first()->collapsed);
        $this->assertTrue((bool) MenuGroup::where('key', 'fun')->first()->collapsed);

        // Admin play'i "kapali basla" yapti.
        MenuGroup::where('key', 'play')->update(['collapsed' => true]);

        $groups = collect($this->getJson('/api/menu-config')->assertOk()->json('groups'))
            ->keyBy('key');
        $this->assertTrue($groups['play']['collapsed']);   // admin override yansidi
        $this->assertFalse($groups['compete']['collapsed']); // degismedi
        $this->assertTrue($groups['content']['collapsed']);  // varsayilan kapali
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
