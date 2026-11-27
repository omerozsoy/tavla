<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Services\FairDiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * ADİL ZAR v2: sunucu commit'i oda KURULURKEN yayınlar; iki oyuncu da commit'i gördükten sonra
 * kendi tohumunu ekler (poll ?cs= veya roll client_seed); ilk zardan sonra tohum DONAR.
 */
class FairDiceSeedContributionTest extends TestCase
{
    use RefreshDatabase;

    private const P1_SEED = 'cccc3333dddd4444';

    private const P2_SEED = 'aaaa1111bbbb2222';

    private User $u1;

    private User $u2;

    private function room(): Room
    {
        $this->u1 = User::factory()->create(['coins' => 1000]);
        $this->u2 = User::factory()->create(['coins' => 1000]);

        return Room::create([
            'code' => 'FDS'.random_int(100, 999),
            'p1_token' => 'p1-token',
            'p1_user_id' => $this->u1->id,
            'p1_name' => 'A',
            'p2_token' => 'p2-token',
            'p2_user_id' => $this->u2->id,
            'p2_name' => 'Opponent',
            'status' => 'playing',
            'mode' => 'friendly',
            'authoritative' => true,
            'stake' => 0,
            'bet_pct' => 0,
            'version' => 0,
            'server_version' => 0,
        ]);
    }

    private function poll(Room $room, string $token, string $cs): void
    {
        Sanctum::actingAs($token === 'p1-token' ? $this->u1 : $this->u2);
        $this->withHeader('X-Room-Token', $token)
            ->getJson("/api/rooms/{$room->code}?cs={$cs}")
            ->assertOk();
    }

    private function openingRoll(Room $room, ?string $seed): TestResponse
    {
        Sanctum::actingAs($this->u1);

        return $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'command_id' => (string) Str::uuid(),
            'expected_version' => 0,
            'client_seed' => $seed,
        ]);
    }

    public function test_commit_exists_at_creation_before_any_player_seed(): void
    {
        $room = $this->room();

        $this->assertNotEmpty($room->dice_seed);
        $this->assertSame(hash('sha256', $room->dice_seed), $room->dice_commit);
        $this->assertSame('.', $room->dice_client_seed);
        $this->assertSame($room->dice_commit, $room->toClient()['dice_commit']); // istemci görür
        $this->assertNull($room->toClient()['dice_seed']); // tohum gizli
    }

    public function test_both_players_contribute_and_seed_freezes_after_opening(): void
    {
        $room = $this->room();

        // p2 poll ile katkı verir.
        $this->poll($room, 'p2-token', self::P2_SEED);
        $this->assertSame('.'.self::P2_SEED, $room->fresh()->dice_client_seed);

        // p2 ikinci kez farklı tohum yollayamaz (slot başına bir kez).
        $this->poll($room, 'p2-token', 'eeee5555ffff6666');
        $this->assertSame('.'.self::P2_SEED, $room->fresh()->dice_client_seed);

        // p1 açılış roll'unda katkı verir; açılış birleşik tohumla üretilir.
        $res = $this->openingRoll($room, self::P1_SEED)->assertOk();
        $res->assertJsonPath('opening', true);
        $fresh = $room->fresh();
        $cs = self::P1_SEED.'.'.self::P2_SEED;
        $this->assertSame($cs, $fresh->dice_client_seed);

        $dice = new FairDiceService;
        $opening = $fresh->dice_rolls[0];
        $this->assertSame($dice->openingDie($fresh->dice_seed, $cs, 1, 0), $opening['white']);

        // Donmuş: açılıştan sonra yeni katkı kabul edilmez (p1 de olsa, poll da olsa).
        $this->poll($room, 'p1-token', 'eeee5555ffff6666');
        $this->assertSame($cs, $room->fresh()->dice_client_seed);
    }

    public function test_invalid_or_spectator_seed_is_ignored(): void
    {
        $room = $this->room();

        $this->poll($room, 'p2-token', 'x:single');
        $this->assertSame('.', $room->fresh()->dice_client_seed);

        // Tohumsuz açılış da çalışır (eksik katkı boş kalır, doğrulamada görünür).
        $this->openingRoll($room, null)->assertOk()->assertJsonPath('opening', true);
        $this->assertSame('.', $room->fresh()->dice_client_seed);
    }
}
