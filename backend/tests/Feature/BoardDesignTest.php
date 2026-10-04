<?php

namespace Tests\Feature;

use App\Filament\Resources\BoardDesignResource\Pages\CreateBoardDesign;
use App\Filament\Resources\BoardDesignResource\Pages\EditBoardDesign;
use App\Filament\Resources\BoardDesignResource\Pages\ListBoardDesigns;
use App\Http\Controllers\ShopController;
use App\Models\BoardDesign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Livewire\Livewire;
use Tests\TestCase;

// Admin "Tavla Tasarımı": özel tahta oluştur (renk/ad/fiyat/grup), yerleşik tahtaların grubunu/
// fiyatını/satışını değiştir; mağaza kataloğu + herkese açık /api/board-designs bunu yansıtır.
class BoardDesignTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
        $this->admin->forceFill(['is_admin' => true])->save();
    }

    private function colors(): array
    {
        return ['panel' => '#112233', 'frame' => '#000000', 'a' => '#AA0000', 'b' => '#00aa00', 'checker' => '#101010', 'light' => '#fafafa'];
    }

    private function buyer(int $coins = 5000): User
    {
        $u = User::factory()->create();
        $u->forceFill(['coins' => $coins])->save();

        return $u->fresh();
    }

    public function test_builtins_are_synced_and_listed(): void
    {
        $this->assertGreaterThan(100, BoardDesign::where('is_custom', false)->count()); // migration seed
        BoardDesign::where('slug', 'iznik')->delete();
        Livewire::actingAs($this->admin)->test(ListBoardDesigns::class)->assertOk();
        $this->assertSame('tavlatv', BoardDesign::where('slug', 'iznik')->value('group')); // geri senkronlandı
    }

    public function test_admin_creates_custom_board_and_player_buys_it(): void
    {
        Livewire::actingAs($this->admin)->test(CreateBoardDesign::class)
            ->fillForm(['name' => 'Gece Mavisi', 'group' => 'epic', 'price' => 777, 'active' => true, 'colors' => $this->colors(), 'surface' => 'wood', 'checker_style' => 'gloss'])
            ->call('create')->assertHasNoFormErrors();
        $d = BoardDesign::where('name', 'Gece Mavisi')->firstOrFail();
        $this->assertTrue($d->is_custom);
        $this->assertStringStartsWith('ozel-', $d->slug);
        $this->assertSame('#aa0000', $d->colors['a']);

        $api = $this->getJson('/api/board-designs')->assertOk()->json('designs');
        $row = collect($api)->firstWhere('id', $d->slug);
        $this->assertSame(['epic', 777, true, 'Gece Mavisi', 'wood', 'gloss'], [$row['group'], $row['price'], $row['custom'], $row['name'], $row['surface'], $row['checker_style']]);

        $u = $this->buyer();
        Sanctum::actingAs($u);
        $this->assertSame(777, $this->getJson('/api/shop')->assertOk()->json('catalog')['theme.'.$d->slug] ?? null);
        $this->postJson('/api/shop/buy', ['id' => 'theme.'.$d->slug])->assertOk();
        $this->assertSame(5000 - 777, (int) $u->fresh()->coins);
        $this->assertContains('theme.'.$d->slug, $u->fresh()->unlocks);
    }

    public function test_invalid_color_rejected(): void
    {
        Livewire::actingAs($this->admin)->test(CreateBoardDesign::class)
            ->fillForm(['name' => 'Bozuk', 'group' => 'common', 'colors' => ['panel' => 'red'] + $this->colors()])
            ->call('create')->assertHasFormErrors(['colors.panel']);
        $this->assertFalse(BoardDesign::where('name', 'Bozuk')->exists());
    }

    public function test_custom_board_without_price_uses_group_price(): void
    {
        $d = BoardDesign::create(['name' => 'X', 'group' => 'legendary', 'is_custom' => true, 'colors' => $this->colors()]);
        $this->assertSame(ShopController::groupPrice('legendary'), ShopController::boardPrices()[$d->slug]);
    }

    public function test_builtin_group_price_and_active_overrides_reach_catalog(): void
    {
        $this->assertSame(ShopController::groupPrice('common'), ShopController::boardPrices()['sahara']);
        BoardDesign::where('slug', 'sahara')->firstOrFail()->update(['group' => 'mythic']);
        $this->assertSame(ShopController::groupPrice('mythic'), ShopController::boardPrices()['sahara']);
        BoardDesign::where('slug', 'sahara')->firstOrFail()->update(['price' => 42]);
        $this->assertSame(42, ShopController::boardPrices()['sahara']);
        BoardDesign::where('slug', 'sahara')->firstOrFail()->update(['active' => false]);
        $this->assertArrayNotHasKey('sahara', ShopController::boardPrices());

        Sanctum::actingAs($this->buyer());
        $this->postJson('/api/shop/buy', ['id' => 'theme.sahara'])->assertStatus(404); // satıştan kaldırıldı
    }

    public function test_builtin_colors_and_name_cannot_be_edited(): void
    {
        $d = BoardDesign::where('slug', 'ruby')->firstOrFail();
        $before = $d->colors;
        Livewire::actingAs($this->admin)->test(EditBoardDesign::class, ['record' => $d->getRouteKey()])
            ->fillForm(['group' => 'mythic', 'name' => 'Hack', 'colors' => $this->colors()])
            ->call('save')->assertHasNoFormErrors();
        $d->refresh();
        $this->assertSame(['mythic', 'Ruby', $before], [$d->group, $d->name, $d->colors]);
    }

    public function test_standart_stays_free(): void
    {
        BoardDesign::where('slug', 'standart')->firstOrFail()->update(['price' => 500, 'group' => 'mythic']);
        $this->assertArrayNotHasKey('standart', ShopController::boardPrices());
    }

    public function test_owned_custom_board_cannot_be_deleted(): void
    {
        $d = BoardDesign::create(['name' => 'Y', 'group' => 'common', 'is_custom' => true, 'colors' => $this->colors()]);
        $u = $this->buyer();
        $u->forceFill(['unlocks' => ['theme.'.$d->slug]])->save();
        Livewire::actingAs($this->admin)->test(ListBoardDesigns::class)
            ->callTableAction('delete', $d);
        $this->assertTrue(BoardDesign::whereKey($d->id)->exists());

        $free = BoardDesign::create(['name' => 'Z', 'group' => 'common', 'is_custom' => true, 'colors' => $this->colors()]);
        Livewire::actingAs($this->admin)->test(ListBoardDesigns::class)
            ->callTableAction('delete', $free);
        $this->assertFalse(BoardDesign::whereKey($free->id)->exists());
    }

    public function test_bulk_move_group(): void
    {
        $ids = BoardDesign::whereIn('slug', ['jade', 'coral', 'standart'])->get();
        Livewire::actingAs($this->admin)->test(ListBoardDesigns::class)
            ->callTableBulkAction('moveGroup', $ids, data: ['group' => 'rare']);
        $this->assertSame('rare', BoardDesign::where('slug', 'jade')->value('group'));
        $this->assertSame('rare', BoardDesign::where('slug', 'coral')->value('group'));
        $this->assertSame('common', BoardDesign::where('slug', 'standart')->value('group'));
    }

    public function test_lucky_wheel_pool_includes_active_custom_boards(): void
    {
        $d = BoardDesign::create(['name' => 'W', 'group' => 'rare', 'is_custom' => true, 'colors' => $this->colors()]);
        $this->assertContains($d->slug, ShopController::boardThemeIds());
        $d->update(['active' => false]);
        $this->assertNotContains($d->slug, ShopController::boardThemeIds());
    }
}
