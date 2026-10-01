<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
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

    /**
     * MAVI EKRAN KÖK FIX: enter() ile kurulan otoriter oda, iki oyuncu belli olunca (playing) AÇILIŞ
     * tahtasını (server_state) ANINDA seed etmeli — matchmaking/bot yoluyla AYNI. Aksi halde otoriter
     * istemci server_state gelene (ilk roll) kadar BOŞ/mavi ekranda kalıyordu.
     */
    public function test_enter_seeds_server_state_so_board_is_never_blank(): void
    {
        config()->set('game.server_authoritative', true);
        $code = 'TRNMT2';
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1tok', 'name' => 'A'])->assertOk();
        $room = Room::where('code', strtoupper($code))->first();
        $this->assertNull($room->server_state, 'Tek oyuncu (waiting) iken henüz tahta kurulmaz.');

        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p2tok', 'name' => 'B'])->assertOk();

        $room->refresh();
        $this->assertSame('playing', $room->status);
        $this->assertIsArray($room->server_state, 'İki oyuncu belli -> otoriter açılış tahtası seed edilmeli (boş/mavi ekran yok).');
        $this->assertCount(24, $room->server_state['points'] ?? [], 'Geçerli açılış pozisyonu (24 hane).');
        $this->assertIsArray($room->server_match);
        $this->assertSame(false, $room->server_match['opened'] ?? null, 'Açılış eli henüz atılmadı (ilk roll açar).');
    }

    /**
     * REGRESYON: "arkadaşla 5'lik maç seçtik ama 1'lik başladı". Davet EDEN odayı enter() ile
     * KURARKEN maç uzunluğunu davetten (game_invites) almalı; aksi halde rooms.target NULL kalıp
     * server_match 1'e düşüyordu. Hem açık gelen 'target' hem de davet-yedeği doğrulanır.
     */
    public function test_enter_adopts_target_from_invite(): void
    {
        $inviter = User::factory()->create();
        $invitee = User::factory()->create();
        $code = 'INVT55';
        DB::table('game_invites')->insert([
            'from_user_id' => $inviter->id,
            'to_user_id' => $invitee->id,
            'room_code' => $code,
            'target' => 5,
            'time_control' => 'normal',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Davet EDEN odayı ilk kez kurar — istemci target GÖNDERMESE de davetten alınmalı.
        Sanctum::actingAs($inviter);
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1tok', 'name' => 'A'])->assertOk();

        $room = Room::where('code', $code)->firstOrFail();
        $this->assertSame(5, (int) $room->target, 'Davetle kurulan oda maç uzunluğunu (5) davetten almalı, 1 olmamalı.');
        $this->assertSame('friendly', $room->mode, 'Davetle kurulan oda arkadaşlık maçı (friendly) olmalı.');
    }

    public function test_enter_prefers_explicit_target_over_default(): void
    {
        $code = 'ENTGT7';
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1tok', 'name' => 'A', 'target' => 7])->assertOk();

        $this->assertSame(7, (int) Room::where('code', $code)->firstOrFail()->target);
    }

    public function test_room_authoritative_even_when_global_off(): void
    {
        // DİREKTİF: TÜM MAÇLAR OTORİTER (shouldAuthoritative koşulsuz true, env/config'e BAĞIMSIZ).
        // Global config KAPALI + bahis YOK olsa bile oda otoriter kurulur -> "limbo oda" (ne otoriter
        // server_state ne legacy PUT senkronu -> PUT 409) sınıfı kökten kapalı. ESKİ davranış (global
        // kapalıysa legacy=false) BİLİNÇLİ olarak kaldırıldı; bu test artık direktifin regresyon
        // bekçisi (biri env-gating'i geri getirirse yakalar).
        config()->set('game.server_authoritative', false);
        config()->set('game.authoritative_users', []);
        $code = $this->postJson('/api/rooms', ['token' => 'p1tok', 'name' => 'A'])
            ->assertOk()->json('room.code');
        $this->postJson("/api/rooms/{$code}/join", ['token' => 'p2tok', 'name' => 'B'])->assertOk();

        $this->assertTrue(
            (bool) Room::where('code', $code)->first()->authoritative,
            'Tüm maçlar otoriter direktifi: global kapalı + bahissiz oda bile authoritative olmalı.'
        );
    }

    public function test_authenticated_join_ignores_client_identity_metadata(): void
    {
        $owner = User::factory()->create(['rating' => 1500, 'nickname' => 'Owner']);
        $joiner = User::factory()->create(['rating' => 1825, 'nickname' => 'Verified Player']);

        Sanctum::actingAs($owner);
        $code = $this->postJson('/api/rooms', [
            'token' => 'p1tok', 'name' => 'Forged Owner', 'rating' => 100,
        ])->assertOk()->json('room.code');

        Sanctum::actingAs($joiner);
        $this->postJson("/api/rooms/{$code}/join", [
            'token' => 'p2tok', 'name' => 'Forged Opponent', 'rating' => 3999,
            'avatar' => 'data:image/png;base64,forged',
        ])->assertOk();

        $room = Room::where('code', $code)->firstOrFail();
        $this->assertSame('Verified Player', $room->p2_name);
        $this->assertSame(1825, (int) $room->p2_rating);
        $this->assertSame($joiner->id, (int) $room->p2_user_id);
    }
}
