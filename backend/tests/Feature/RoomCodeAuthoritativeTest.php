<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kod-tabanlı odalar (arkadaş = create+join, turnuva = enter) da global SERVER_AUTHORITATIVE
 * açıkken sunucu-otoriter olmalı — matchmake ile AYNI. Onceden yalniz matchmake authoritative
 * set ediyordu; join/enter unutulmustu (arkadas+turnuva maclari legacy/istemci-otoriter kaliyordu).
 */
class RoomCodeAuthoritativeTest extends TestCase
{
    use RefreshDatabase;

    public function test_join_makes_room_authoritative_when_global_on(): void
    {
        config()->set('game.server_authoritative', true);
        $code = $this->postJson('/api/rooms', ['token' => 'p1tok', 'name' => 'A'])
            ->assertOk()->json('room.code');
        $this->postJson("/api/rooms/{$code}/join", ['token' => 'p2tok', 'name' => 'B'])->assertOk();

        $room = Room::where('code', $code)->first();
        $this->assertTrue((bool) $room->authoritative, 'Arkadaş oyunu (join) global otorite açıkken authoritative olmalı.');
        $this->assertFalse((bool) $room->dice_authority, 'authoritative iken Faz-1 dice_authority kapalı olmalı.');
    }

    public function test_enter_makes_room_authoritative_when_global_on(): void
    {
        config()->set('game.server_authoritative', true);
        $code = 'TRNMT1';
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1tok', 'name' => 'A'])->assertOk();
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p2tok', 'name' => 'B'])->assertOk();

        $room = Room::where('code', strtoupper($code))->first();
        $this->assertTrue((bool) $room->authoritative, 'Turnuva maçı (enter) global otorite açıkken authoritative olmalı.');
    }

    public function test_room_stays_legacy_when_global_off(): void
    {
        config()->set('game.server_authoritative', false);
        config()->set('game.authoritative_users', []);
        $code = $this->postJson('/api/rooms', ['token' => 'p1tok', 'name' => 'A'])
            ->assertOk()->json('room.code');
        $this->postJson("/api/rooms/{$code}/join", ['token' => 'p2tok', 'name' => 'B'])->assertOk();

        // Global kapalı + stake yok -> eski davranış korunur (authoritative=false).
        $this->assertFalse((bool) Room::where('code', $code)->first()->authoritative);
    }
}
