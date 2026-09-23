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

    // Direktif: BOT hariç tüm maçlar izlenebilir. Davet (friendly) maçı katılımcı olmayanca
    // da görüntülenir; BOT maçı izleyiciye kapalıdır.
    public function test_non_bot_room_state_is_viewable_bot_is_private(): void
    {
        $room = $this->room();
        $room->mode = 'friendly';
        $room->save();
        // Davet maçı: katılımcı olmayan izleyici de okuyabilir.
        $this->getJson("/api/rooms/{$room->code}")->assertOk();

        // Bot maçı: slot yoksa (izleyici) 403.
        $bot = Room::create([
            'code' => 'BOTX', 'p1_token' => 'bp1', 'p1_name' => 'Human',
            'p2_token' => 'bp2', 'p2_name' => 'Bot', 'status' => 'playing', 'bot' => true,
        ]);
        $this->getJson("/api/rooms/{$bot->code}")->assertForbidden();
    }

    public function test_live_matches_lists_non_bot_including_friendly_and_excludes_bot(): void
    {
        Room::create([
            'code' => 'FRIENDY',
            'p1_token' => 'friend-p1', 'p1_name' => 'Private A',
            'p2_token' => 'friend-p2', 'p2_name' => 'Private B',
            'status' => 'playing', 'mode' => 'friendly',
            'state' => ['turn' => 'white'],
        ]);
        Room::create([
            'code' => 'RANKEDY',
            'p1_token' => 'ranked-p1', 'p1_name' => 'Public A',
            'p2_token' => 'ranked-p2', 'p2_name' => 'Public B',
            'status' => 'playing', 'state' => ['turn' => 'white'],
        ]);
        Room::create([
            'code' => 'BOTMATCH',
            'p1_token' => 'bot-p1', 'p1_name' => 'Human',
            'p2_token' => 'bot-p2', 'p2_name' => 'Bot',
            'status' => 'playing', 'bot' => true, 'state' => ['turn' => 'white'],
        ]);

        $codes = collect($this->getJson('/api/live-matches')->assertOk()->json('matches'))
            ->pluck('code')->all();

        $this->assertContains('FRIENDY', $codes);     // davet maçı artık listelenir
        $this->assertContains('RANKEDY', $codes);
        $this->assertNotContains('BOTMATCH', $codes);  // bot hariç
    }

    public function test_non_bot_watch_is_public_bot_watch_is_private(): void
    {
        $room = $this->room();
        $room->mode = 'friendly';
        $room->save();
        // Davet maçı: katılımcı olmayan izleyici presence upsert edebilir.
        $this->postJson("/api/rooms/{$room->code}/watch", [
            'token' => 'spectator-token',
        ])->assertOk();

        // Bot maçı: izleyiciye kapalı.
        $bot = Room::create([
            'code' => 'BOTW', 'p1_token' => 'bp1', 'p1_name' => 'Human',
            'p2_token' => 'bp2', 'p2_name' => 'Bot', 'status' => 'playing', 'bot' => true,
        ]);
        $this->postJson("/api/rooms/{$bot->code}/watch", [
            'token' => 'spectator-token',
        ])->assertForbidden();
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
