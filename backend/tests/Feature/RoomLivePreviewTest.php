<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * CANLI hamle önizlemesi (cosmetic): /rooms/{code}/live sıradaki oyuncunun adımlarını yazar,
 * show() bunları döndürür -> rakip adım adım animasyonla görür. OTORİTE DEĞİL: version BUMP OLMAZ.
 */
class RoomLivePreviewTest extends TestCase
{
    use RefreshDatabase;

    private ?User $p1 = null;
    private ?User $p2 = null;

    private function acting(string $token): void
    {
        Sanctum::actingAs($token === 'p1' ? $this->p1 : $this->p2);
    }

    private function room(): Room
    {
        $this->p1 = User::factory()->create(['id' => 10]);
        $this->p2 = User::factory()->create(['id' => 20]);
        return Room::create([
            'code' => 'LIVEX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 5,
        ]);
    }

    public function test_live_stores_steps_and_show_returns_them(): void
    {
        $room = $this->room();
        $steps = [['from' => 23, 'to' => 20, 'die' => 3], ['from' => 20, 'to' => 18, 'die' => 2]];

        $this->acting('p1');
        $res = $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'p1', 'steps' => $steps, 'turn' => 'white', 'seq' => 4,
        ]);
        $res->assertOk()->assertJsonPath('ok', true);

        // Kaydedildi + slot doğru + version DEĞİŞMEDİ (cosmetic).
        $room->refresh();
        $this->assertSame('p1', $room->live['slot']);
        $this->assertCount(2, $room->live['steps']);
        $this->assertSame('white', $room->live['turn']);
        $this->assertSame(5, (int) $room->version, 'live version BUMP etmemeli');

        // show() live'ı döndürür (rakip poll'da okur).
        $show = $this->getJson("/api/rooms/{$room->code}?token=p2");
        $show->assertOk()
            ->assertJsonPath('room.live.slot', 'p1')
            ->assertJsonPath('room.live.turn', 'white');
    }

    public function test_live_rejects_non_member(): void
    {
        $room = $this->room();
        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'not-in-room', 'steps' => [],
        ])->assertStatus(403);
    }

    public function test_friendly_room_state_is_private_to_participants(): void
    {
        $room = $this->room();
        $room->mode = 'friendly';
        $room->save();

        $this->getJson("/api/rooms/{$room->code}")->assertForbidden();
        $this->acting('p1');
        $this->getJson("/api/rooms/{$room->code}?token=p1")->assertOk();
    }

    public function test_live_empty_steps_clears_preview(): void
    {
        $room = $this->room();
        $this->acting('p2');
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'p2', 'steps' => [['from' => 5, 'to' => 2, 'die' => 3]], 'turn' => 'black',
        ])->assertOk();
        $this->acting('p2');
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'p2', 'steps' => [], 'turn' => 'black',
        ])->assertOk();

        $room->refresh();
        $this->assertSame([], $room->live['steps']);
    }
}
