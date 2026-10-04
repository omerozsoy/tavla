<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\WalletService;
use App\Support\UserEraser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Kullanıcı silinince coin defteri + ödeme geçmişi cascade ile İZSİZ gidiyordu. Artık: mali geçmişi
// olan hesap fiziksel silinemez (model engeli); silme talebi ANONİMLEŞTİRME yapar (kişisel/sosyal veri
// silinir, mali kayıtlar ve maç geçmişi kalır). Mali geçmişi olmayan hesap eskisi gibi silinir.
class UserFinancialErasureTest extends TestCase
{
    use RefreshDatabase;

    private function withLedger(): User
    {
        $u = User::factory()->create(['email' => 'ben@ornek.test', 'phone' => '05551112233', 'avatar' => '/a.png']);
        app(WalletService::class)->credit($u, 500, 'admin_adjustment');

        return $u->fresh();
    }

    public function test_direct_delete_of_user_with_financial_history_is_blocked(): void
    {
        $u = $this->withLedger();
        $this->expectException(\RuntimeException::class);
        $u->delete();
    }

    public function test_self_delete_anonymizes_and_keeps_ledger_and_payments(): void
    {
        $u = $this->withLedger();
        $friend = User::factory()->create();
        Payment::create(['user_id' => $u->id, 'kind' => 'coins', 'order_id' => 'TC-er1', 'amount' => 1000,
            'coins' => 100, 'currency' => '949', 'status' => 'paid']);
        DB::table('friendships')->insert(['user_id' => $u->id, 'friend_id' => $friend->id, 'status' => 'accepted',
            'created_at' => now(), 'updated_at' => now()]);
        DB::table('messages')->insert(['sender_id' => $u->id, 'receiver_id' => $friend->id, 'body' => 'özel', 'created_at' => now()]);
        $token = $u->createToken('t')->plainTextToken;

        Sanctum::actingAs($u);
        $this->deleteJson('/api/account')->assertOk();

        $row = User::find($u->id);
        $this->assertNotNull($row, 'mali geçmişli hesap fiziksel silinmemeli');
        $this->assertSame('deleted-'.$u->id.'@deleted.invalid', $row->email);
        $this->assertNull($row->phone);
        $this->assertNull($row->avatar);
        $this->assertSame('Silinmiş', $row->first_name);
        $this->assertTrue($row->isBanned(), 'giriş kapalı olmalı');
        $this->assertSame(0, $row->tokens()->count());
        $this->assertNull(\Laravel\Sanctum\PersonalAccessToken::findToken($token));
        $this->assertTrue(DB::table('wallet_transactions')->where('user_id', $u->id)->exists(), 'defter korunmalı');
        $this->assertTrue(DB::table('payments')->where('user_id', $u->id)->exists(), 'ödeme kaydı korunmalı');
        $this->assertFalse(DB::table('friendships')->where('user_id', $u->id)->exists(), 'sosyal veri silinmeli');
        $this->assertFalse(DB::table('messages')->where('sender_id', $u->id)->exists(), 'mesajlar silinmeli');
        // Aynı e-posta yeniden kayıt için serbest.
        $this->assertFalse(User::where('email', 'ben@ornek.test')->exists());
    }

    public function test_user_without_financial_history_is_still_deleted(): void
    {
        $u = User::factory()->create();
        UserEraser::erase($u);
        $this->assertNull(User::find($u->id));
    }
}
