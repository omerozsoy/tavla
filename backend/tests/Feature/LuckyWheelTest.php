<?php

namespace Tests\Feature;

use App\Models\LuckyWheelReward;
use App\Models\LuckyWheelSpin;
use App\Models\LuckyWheelUserState;
use App\Models\Setting;
use App\Models\User;
use App\Services\LuckyWheel\LuckyWheelService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Şans Çarkı: dinamik dilim sayısı, sunucu-otoriter weighted random, çevirme hakkı,
 * limit/stok, snapshot ve API. Kazananı DAİMA sunucu belirler.
 */
class LuckyWheelTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n = 'p'): User
    {
        return User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n.substr(md5($n.microtime()), 0, 4),
            'email' => $n.substr(md5($n.microtime()), 0, 6).'@e.com',
            'password' => bcrypt('secret123'), 'coins' => 0,
        ]);
    }

    private function reward(array $attr): LuckyWheelReward
    {
        return LuckyWheelReward::create(array_merge([
            'name' => 'R', 'type' => 'COIN', 'amount' => 10, 'weight' => 10, 'is_active' => true, 'sort' => 0,
        ], $attr));
    }

    private function svc(): LuckyWheelService
    {
        return app(LuckyWheelService::class);
    }

    private function grantSpins(User $u, int $n): void
    {
        $s = LuckyWheelUserState::forUser($u->id);
        $s->bonus_spins = $n;
        $s->save();
    }

    public function test_slice_count_equals_active_reward_count(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->reward(['name' => "R$i", 'sort' => $i]);
        }
        // Bir tanesi pasif -> havuza girmez.
        $this->reward(['name' => 'Off', 'is_active' => false]);

        $pool = $this->svc()->eligibleRewards();
        $this->assertCount(6, $pool, 'Dilim sayısı = aktif ödül sayısı olmalı (sabit değil)');
    }

    public function test_out_of_stock_and_date_rewards_excluded(): void
    {
        $this->reward(['name' => 'InStock']);
        $this->reward(['name' => 'NoStock', 'stock' => 0]);
        $this->reward(['name' => 'Future', 'starts_at' => now()->addDay()]);
        $this->reward(['name' => 'Past', 'ends_at' => now()->subDay()]);

        $names = $this->svc()->eligibleRewards()->pluck('name')->all();
        $this->assertSame(['InStock'], $names);
    }

    public function test_wheel_not_ready_below_min_slices(): void
    {
        Setting::put('lw_min_slice_count', 4);
        $this->reward(['name' => 'A']);
        $this->reward(['name' => 'B']);
        $u = $this->user();
        $this->grantSpins($u, 5);

        $r = $this->svc()->spin($u);
        $this->assertSame('not_ready', $r['error']);
    }

    public function test_weighted_random_respects_weights(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $this->reward(['name' => 'Heavy', 'weight' => 90]);
        $this->reward(['name' => 'Light', 'weight' => 10]);
        $u = $this->user();
        $this->grantSpins($u, 3000);

        $counts = ['Heavy' => 0, 'Light' => 0];
        for ($i = 0; $i < 2000; $i++) {
            $res = $this->svc()->spin($u);
            $counts[$res['reward']['name']]++;
        }
        // 90/10 dağılım: Heavy belirgin çoğunlukta (istatistiksel geniş tolerans).
        $this->assertGreaterThan($counts['Light'] * 4, $counts['Heavy']);
    }

    public function test_zero_weight_reward_shown_but_never_won(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $this->reward(['name' => 'Winnable', 'weight' => 10]);
        $this->reward(['name' => 'Display', 'weight' => 0]);
        $u = $this->user();
        $this->grantSpins($u, 200);

        // Dilim olarak görünür (havuzda 2)...
        $this->assertCount(2, $this->svc()->eligibleRewards());
        for ($i = 0; $i < 100; $i++) {
            $res = $this->svc()->spin($u);
            $this->assertSame('Winnable', $res['reward']['name'], 'weight=0 asla kazanılmamalı');
        }
    }

    public function test_lifetime_limit_and_stock_enforced(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $common = $this->reward(['name' => 'Common', 'weight' => 1]);
        $jackpot = $this->reward(['name' => 'Jackpot', 'weight' => 1000000, 'per_user_lifetime_limit' => 1, 'stock' => 5]);
        $u = $this->user();
        $this->grantSpins($u, 6);

        $names = [];
        for ($i = 0; $i < 6; $i++) {
            $names[] = $this->svc()->spin($u)['reward']['name'];
        }
        $this->assertSame(1, LuckyWheelSpin::where('reward_id', $jackpot->id)->count(), 'Jackpot ömür boyu 1 kez');
        $this->assertSame(4, $jackpot->fresh()->stock, 'Stok yalnız kazanımda düşer (5-1)');
    }

    public function test_spin_consumes_rights_and_grants_coins(): void
    {
        Setting::put('lw_min_slice_count', 2);
        Setting::put('lw_free_spins_per_day', 1);
        $this->reward(['name' => 'C1', 'type' => 'COIN', 'amount' => 100, 'weight' => 1]);
        $this->reward(['name' => 'C2', 'type' => 'COIN', 'amount' => 100, 'weight' => 1]);
        $u = $this->user();

        // 1 ücretsiz hak -> ilk spin başarılı, ikinci hak yok.
        $r1 = $this->svc()->spin($u);
        $this->assertArrayNotHasKey('error', $r1);
        $this->assertSame(100, $u->fresh()->coins);

        $r2 = $this->svc()->spin($u);
        $this->assertSame('no_spins', $r2['error']);
    }

    public function test_free_spin_reward_adds_bonus(): void
    {
        Setting::put('lw_min_slice_count', 2);
        Setting::put('lw_free_spins_per_day', 0);
        $this->reward(['name' => 'Bonus', 'type' => 'FREE_SPIN', 'amount' => 2, 'weight' => 1]);
        $this->reward(['name' => 'Filler', 'weight' => 0]); // görünür ama kazanılmaz
        $u = $this->user();
        $this->grantSpins($u, 1);

        $res = $this->svc()->spin($u);
        $this->assertSame('Bonus', $res['reward']['name']);
        // 1 harcandı, +2 kazanıldı => 2 kaldı.
        $this->assertSame(2, LuckyWheelUserState::forUser($u->id)->bonus_spins);
    }

    public function test_snapshot_preserved_after_reward_changed(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $r = $this->reward(['name' => 'Orig', 'type' => 'COIN', 'amount' => 250, 'weight' => 1]);
        $this->reward(['name' => 'Other', 'weight' => 0]);
        $u = $this->user();
        $this->grantSpins($u, 1);

        $this->svc()->spin($u);
        $r->update(['name' => 'Renamed', 'amount' => 5]);

        $spin = LuckyWheelSpin::first();
        $this->assertSame('Orig', $spin->reward_snapshot['name']);
        $this->assertSame(250, $spin->reward_snapshot['amount']);
    }

    public function test_spin_endpoint_is_server_authoritative(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $this->reward(['name' => 'E1', 'type' => 'COIN', 'amount' => 50, 'weight' => 1]);
        $this->reward(['name' => 'E2', 'type' => 'COIN', 'amount' => 50, 'weight' => 1]);
        $u = $this->user();

        // İstemcinin gönderdiği herhangi bir "istek ödülü" yok sayılır; sunucu seçer.
        $res = $this->postJson('/api/lucky-wheel/spin', ['rewardId' => 999], [
            'Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken,
        ]);
        $res->assertOk()->assertJson(['success' => true]);
        $this->assertContains($res->json('reward.name'), ['E1', 'E2']);
        $this->assertNotSame(999, $res->json('winningRewardId'));
    }

    public function test_show_endpoint_returns_pool_and_state(): void
    {
        Setting::put('lw_min_slice_count', 2);
        $this->reward(['name' => 'S1']);
        $this->reward(['name' => 'S2']);
        $this->reward(['name' => 'S3']);
        $u = $this->user();

        $res = $this->getJson('/api/lucky-wheel', [
            'Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken,
        ]);
        $res->assertOk()
            ->assertJsonPath('sliceCount', 3)
            ->assertJsonPath('ready', true);
        $this->assertCount(3, $res->json('rewards'));
    }
}
