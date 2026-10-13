<?php

namespace Tests\Feature;

use App\Models\MenuGroup;
use App\Models\MenuItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GammonTV menü override'ı: gammontv.com host'unda gammon_visible/gammon_label uygulanır,
 * tavlatv.com DEĞİŞMEZ. NULL override = tavlatv'den miras.
 */
class GammonMenuOverrideTest extends TestCase
{
    use RefreshDatabase;

    private function seedMenu(): void
    {
        MenuGroup::query()->delete();
        MenuItem::query()->delete();
        // Grup: tavlatv EN "Play", gammon ismi "Games", gammon'da gizli.
        MenuGroup::create([
            'key' => 'play', 'label_en' => 'Play', 'gammon_label' => 'Games',
            'sort' => 1, 'visible' => true, 'gammon_visible' => false,
        ]);
        // Grup: override yok -> miras.
        MenuGroup::create(['key' => 'info', 'label_en' => 'Info', 'sort' => 2, 'visible' => true]);
        // Sayfa: tavlatv görünür, gammon'da gizli.
        MenuItem::create(['key' => 'solo', 'label_en' => 'Single', 'group' => 'play', 'sort' => 1, 'visible' => true, 'gammon_visible' => false]);
        // Sayfa: override yok -> miras (görünür).
        MenuItem::create(['key' => 'news', 'label_en' => 'News', 'group' => 'info', 'sort' => 2, 'visible' => true]);
    }

    public function test_gammon_host_applies_overrides(): void
    {
        $this->seedMenu();
        $res = $this->getJson('http://www.gammontv.com/api/menu-config');
        $res->assertOk();
        $groups = collect($res->json('groups'))->keyBy('key');
        $items = collect($res->json('items'))->keyBy('key');

        // gammon_label EN etiketini ezer; grup gammon'da gizli.
        $this->assertSame('Games', $groups['play']['labels']['en']);
        $this->assertFalse($groups['play']['visible']);
        // miras: info grubu dokunulmamış.
        $this->assertSame('Info', $groups['info']['labels']['en']);
        $this->assertTrue($groups['info']['visible']);
        // sayfa: solo gammon'da gizli, news görünür (miras).
        $this->assertFalse($items['solo']['visible']);
        $this->assertTrue($items['news']['visible']);
    }

    public function test_tavla_host_ignores_gammon_overrides(): void
    {
        $this->seedMenu();
        $res = $this->getJson('http://www.tavlatv.com/api/menu-config');
        $res->assertOk();
        $groups = collect($res->json('groups'))->keyBy('key');
        $items = collect($res->json('items'))->keyBy('key');

        // tavlatv: gammon_label YOK sayılır -> label_en; her şey görünür.
        $this->assertSame('Play', $groups['play']['labels']['en']);
        $this->assertTrue($groups['play']['visible']);
        $this->assertTrue($items['solo']['visible']);
    }
}
