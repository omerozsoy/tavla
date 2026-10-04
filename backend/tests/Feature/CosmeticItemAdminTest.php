<?php

namespace Tests\Feature;

use App\Filament\Resources\AvatarDesignResource\Pages\ListAvatarDesigns;
use App\Filament\Resources\CheckerDesignResource\Pages\ListCheckerDesigns;
use App\Http\Controllers\ShopController;
use App\Models\CosmeticItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Livewire\Livewire;
use Tests\TestCase;

// Admin "Avatar Tasarımı" / "Pul Tasarımı": grup/fiyat/satış ayarı mağaza kataloğuna ve
// herkese açık /api/board-designs 'items' alanına yansır.
class CosmeticItemAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
        $this->admin->forceFill(['is_admin' => true])->save();
    }

    private function catalog(): array
    {
        $u = User::factory()->create();
        Sanctum::actingAs($u);

        return $this->getJson('/api/shop')->assertOk()->json('catalog');
    }

    private function item(string $kind, string $id): CosmeticItem
    {
        return CosmeticItem::where('kind', $kind)->where('item_id', $id)->firstOrFail();
    }

    public function test_pages_list_only_their_kind(): void
    {
        $frame = $this->item('frame', 'pulse');
        $checker = $this->item('checker', 'finish-pearl');
        Livewire::actingAs($this->admin)->test(ListAvatarDesigns::class)
            ->assertCanSeeTableRecords([$frame])->assertCanNotSeeTableRecords([$checker]);
        Livewire::actingAs($this->admin)->test(ListCheckerDesigns::class)
            ->assertCanSeeTableRecords([$checker])->assertCanNotSeeTableRecords([$frame]);
    }

    public function test_frame_price_group_and_active_reach_catalog(): void
    {
        $this->assertSame(ShopController::rarityPrice('rare'), $this->catalog()['frame.pulse']);
        $this->item('frame', 'pulse')->update(['group' => 'mythic']);
        $this->assertSame(ShopController::rarityPrice('mythic'), $this->catalog()['frame.pulse']);
        $this->item('frame', 'pulse')->update(['price' => 33]);
        $this->assertSame(33, $this->catalog()['frame.pulse']);
        $this->item('frame', 'pulse')->update(['active' => false]);
        $this->assertArrayNotHasKey('frame.pulse', $this->catalog());
        $this->postJson('/api/shop/buy', ['id' => 'frame.pulse'])->assertStatus(404);
        $this->assertNotContains('pulse', ShopController::frameMotionIds());
    }

    public function test_checker_price_change_charges_new_price(): void
    {
        $this->item('checker', 'finish-marble')->update(['price' => 99]);
        $u = User::factory()->create();
        $u->forceFill(['coins' => 1000])->save();
        Sanctum::actingAs($u->fresh());
        $this->postJson('/api/shop/buy', ['id' => 'checker.finish-marble'])->assertOk();
        $this->assertSame(901, (int) $u->fresh()->coins);
    }

    public function test_bulk_set_price_and_public_items(): void
    {
        $recs = CosmeticItem::where('kind', 'checker')->whereIn('item_id', ['finish-pearl', 'finish-resin'])->get();
        Livewire::actingAs($this->admin)->test(ListCheckerDesigns::class)
            ->callTableBulkAction('setPrice', $recs, data: ['price' => 250]);
        $items = collect($this->getJson('/api/board-designs')->assertOk()->json('items'));
        $this->assertSame(250, $items->first(fn ($i) => $i['kind'] === 'checker' && $i['id'] === 'finish-resin')['price']);
        $this->assertSame(250, $this->catalog()['checker.finish-pearl']);
    }
}
