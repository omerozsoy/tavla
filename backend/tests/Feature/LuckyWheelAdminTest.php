<?php

namespace Tests\Feature;

use App\Models\LuckyWheelAudit;
use App\Models\LuckyWheelReward;
use App\Models\User;
use App\Support\LuckyWheelSettings as LWS;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Şans Çarkı YÖNETİM REST ucu: admin koruması, ödül CRUD, sıralama, ayarlar,
 * max-dilim koruması ve otomatik audit.
 */
class LuckyWheelAdminTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): array
    {
        $u = User::create([
            'first_name' => 'Ad', 'last_name' => 'Min', 'country' => '',
            'nickname' => 'adm'.substr(md5(microtime()), 0, 4),
            'email' => 'admin'.substr(md5(microtime()), 0, 5).'@e.com',
            'password' => bcrypt('secret123'),
        ]);
        // is_admin: config admin e-posta listesi -> bu kullanıcı admin.
        config(['services.admin_emails' => [$u->email]]);
        return [$u, ['Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken]];
    }

    private function plainUser(): array
    {
        $u = User::create([
            'first_name' => 'Reg', 'last_name' => 'Ular', 'country' => '',
            'nickname' => 'usr'.substr(md5(microtime()), 0, 4),
            'email' => 'user'.substr(md5(microtime()), 0, 5).'@e.com',
            'password' => bcrypt('secret123'),
        ]);
        return [$u, ['Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken]];
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'name' => 'Test Ödül', 'type' => 'COIN', 'amount' => 100, 'weight' => 10, 'is_active' => true,
        ], $over);
    }

    public function test_non_admin_is_forbidden(): void
    {
        [, $h] = $this->plainUser();
        $this->getJson('/api/admin/lucky-wheel/rewards', $h)->assertStatus(403);
        $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(), $h)->assertStatus(403);
    }

    public function test_guest_is_unauthorized(): void
    {
        $this->getJson('/api/admin/lucky-wheel/rewards')->assertStatus(401);
    }

    public function test_admin_crud_flow(): void
    {
        [, $h] = $this->admin();

        // Create
        $create = $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(['name' => '250 Coin', 'amount' => 250]), $h);
        $create->assertStatus(201)->assertJsonPath('reward.name', '250 Coin');
        $id = $create->json('reward.id');
        $this->assertDatabaseHas('lucky_wheel_rewards', ['id' => $id, 'amount' => 250]);

        // List (gerçek % dolu)
        $list = $this->getJson('/api/admin/lucky-wheel/rewards', $h);
        $list->assertOk()->assertJsonPath('rewards.0.id', $id);
        $this->assertEquals(100, $list->json('rewards.0.probability')); // tek aktif -> %100

        // Update
        $this->putJson("/api/admin/lucky-wheel/rewards/$id", $this->payload(['name' => 'Yeni Ad', 'weight' => 5]), $h)
            ->assertOk()->assertJsonPath('reward.name', 'Yeni Ad')->assertJsonPath('reward.weight', 5);

        // Delete
        $this->deleteJson("/api/admin/lucky-wheel/rewards/$id", [], $h)->assertOk();
        $this->assertDatabaseMissing('lucky_wheel_rewards', ['id' => $id]);
    }

    public function test_validation_rejects_bad_input(): void
    {
        [, $h] = $this->admin();
        // weight 0 reddedilir (kazanılabilir ödül > 0), tip geçersiz reddedilir.
        $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(['weight' => 0]), $h)
            ->assertStatus(422);
        $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(['type' => 'NOPE']), $h)
            ->assertStatus(422);
    }

    public function test_max_slice_guard(): void
    {
        [, $h] = $this->admin();
        LWS::put('max_slice_count', 3);
        for ($i = 0; $i < 3; $i++) {
            LuckyWheelReward::create($this->payload(['name' => "R$i"]));
        }
        // 4. aktif ödül max'ı (3) aşar -> 422.
        $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(['name' => 'R4']), $h)
            ->assertStatus(422);
        // Pasif eklemek serbest.
        $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(['name' => 'Passive', 'is_active' => false]), $h)
            ->assertStatus(201);
    }

    public function test_reorder_sets_sort(): void
    {
        [, $h] = $this->admin();
        $a = LuckyWheelReward::create($this->payload(['name' => 'A']));
        $b = LuckyWheelReward::create($this->payload(['name' => 'B']));
        $c = LuckyWheelReward::create($this->payload(['name' => 'C']));

        $this->postJson('/api/admin/lucky-wheel/reorder', ['ids' => [$c->id, $a->id, $b->id]], $h)->assertOk();

        $this->assertSame(0, $c->fresh()->sort);
        $this->assertSame(1, $a->fresh()->sort);
        $this->assertSame(2, $b->fresh()->sort);
    }

    public function test_settings_update_and_min_max_guard(): void
    {
        [, $h] = $this->admin();

        $this->putJson('/api/admin/lucky-wheel/settings', ['free_spins_per_day' => 3, 'enabled' => false], $h)
            ->assertOk();
        $this->assertSame(3, LWS::int('free_spins_per_day'));
        $this->assertFalse(LWS::bool('enabled'));

        // min > max reddedilir.
        $this->putJson('/api/admin/lucky-wheel/settings', ['min_slice_count' => 10, 'max_slice_count' => 4], $h)
            ->assertStatus(422);
    }

    public function test_writes_are_audited(): void
    {
        [, $h] = $this->admin();
        $create = $this->postJson('/api/admin/lucky-wheel/rewards', $this->payload(), $h);
        $id = $create->json('reward.id');
        $this->putJson("/api/admin/lucky-wheel/rewards/$id", $this->payload(['name' => 'Değişti']), $h)->assertOk();

        $this->assertTrue(LuckyWheelAudit::where('action', 'created')->exists());
        $this->assertTrue(LuckyWheelAudit::where('action', 'updated')->exists());
    }
}
