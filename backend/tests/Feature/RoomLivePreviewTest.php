<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CANLI hamle önizlemesi (cosmetic): /rooms/{code}/live sıradaki oyuncunun adımlarını yazar,
 * show() bunları döndürür -> rakip adım adım animasyonla görür. OTORİTE DEĞİL: version BUMP OLMAZ.
 */
class RoomLivePreviewTest extends TestCase
{
    use RefreshDatabase;

    private function room(): Room
    {
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
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'not-in-room', 'steps' => [],
        ])->assertStatus(403);
    }

    public function test_live_empty_steps_clears_preview(): void
    {
        $room = $this->room();
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'p2', 'steps' => [['from' => 5, 'to' => 2, 'die' => 3]], 'turn' => 'black',
        ])->assertOk();
        $this->postJson("/api/rooms/{$room->code}/live", [
            'token' => 'p2', 'steps' => [], 'turn' => 'black',
        ])->assertOk();

        $room->refresh();
        $this->assertSame([], $room->live['steps']);
    }
}
