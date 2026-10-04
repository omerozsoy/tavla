<?php

namespace Tests\Feature;

use App\Filament\Resources\PaymentResource\Pages\EditPayment;
use App\Filament\Resources\ProductOrderResource\Pages\ListProductOrders;
use App\Models\Payment;
use App\Models\ProductOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

// A-32: panelde havale ödeme durumu değişikliği izsizdi; ödenmiş siparişler silinip defterle bağı
// kopabiliyordu.
class AdminAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $a = User::factory()->create();
        $a->forceFill(['is_admin' => true])->save();

        return $a;
    }

    public function test_bank_transfer_status_change_is_audited(): void
    {
        $admin = $this->admin();
        $u = User::factory()->create();
        $p = Payment::create(['user_id' => $u->id, 'kind' => 'coins', 'payment_method' => 'bank_transfer',
            'order_id' => 'TC-a1', 'amount' => 5000, 'coins' => 100, 'currency' => '949', 'status' => 'pending']);
        Livewire::actingAs($admin)->test(EditPayment::class, ['record' => $p->id])
            ->fillForm(['status' => 'failed'])->call('save')->assertHasNoFormErrors();
        $this->assertTrue(DB::table('shield_events')->where('type', 'filament_payment_status')->exists(),
            'durum değişikliği denetim kaydı yazmalı');
    }

    public function test_paid_order_cannot_be_deleted_but_pending_can(): void
    {
        $admin = $this->admin();
        $u = User::factory()->create();
        $ship = ['ship_name' => 'A B', 'ship_phone' => '5551112233', 'ship_address' => 'X', 'ship_city' => 'İst', 'ship_postal' => '34000'];
        $paid = ProductOrder::create($ship + ['user_id' => $u->id, 'product_name' => 'Tavla', 'qty' => 1,
            'payment_type' => 'coin', 'amount' => 100, 'status' => 'paid']);
        $pending = ProductOrder::create($ship + ['user_id' => $u->id, 'product_name' => 'Tavla', 'qty' => 1,
            'payment_type' => 'money', 'amount' => 100, 'status' => 'pending']);
        Livewire::actingAs($admin)->test(ListProductOrders::class)
            ->assertTableActionHidden('delete', $paid)
            ->assertTableActionVisible('delete', $pending)
            ->callTableBulkAction('deleteUnpaid', [$paid, $pending]);
        $this->assertNotNull(ProductOrder::find($paid->id), 'ödenmiş sipariş silinmemeli');
        $this->assertNull(ProductOrder::find($pending->id));
    }

    public function test_panel_image_uploads_reject_svg(): void
    {
        // A-32: ->image() "image/*" (SVG dahil) kabul ediyordu; ek kural yalnız raster türlere izin verir.
        $c = \Filament\Forms\Components\FileUpload::make('x')->image();
        $prop = new \ReflectionProperty($c, 'rules');
        $rules = array_map(fn ($r) => is_array($r) ? $r[0] : $r, $prop->getValue($c));
        $this->assertContains('mimes:png,jpg,jpeg,webp,gif', $rules);
    }
}
