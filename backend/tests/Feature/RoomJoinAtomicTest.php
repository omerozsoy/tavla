<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-15: join() ikinci koltuğu oku-kontrol-yaz ile alıyordu; eşzamanlı iki katılımda sonraki
// save() ilkinin p2 koltuğunu sessizce eziyordu. Artık koşullu UPDATE: kaybeden 409 alır.
class RoomJoinAtomicTest extends TestCase
{
    use RefreshDatabase;

    public function test_concurrent_join_does_not_overwrite_seated_player(): void
    {
        $owner = User::factory()->create();
        Room::create(['code' => 'JAT01', 'p1_token' => 't1', 'p1_user_id' => $owner->id, 'p1_name' => 'Sahip',
            'status' => 'waiting', 'version' => 0]);

        // Yarış simülasyonu: controller odayı OKUDUKTAN hemen sonra başka bir istek koltuğu kapar.
        $raced = false;
        Room::retrieved(function (Room $r) use (&$raced) {
            if (! $raced && $r->code === 'JAT01') {
                $raced = true;
                DB::table('rooms')->where('id', $r->id)->update(['p2_token' => 'ilk', 'p2_name' => 'İlk', 'status' => 'playing']);
            }
        });

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/rooms/JAT01/join', ['token' => 'ikinci', 'name' => 'İkinci'])->assertStatus(409);

        $room = Room::where('code', 'JAT01')->first();
        $this->assertSame('ilk', $room->p2_token, 'ilk oturan oyuncunun koltuğu korunmalı');
        $this->assertSame('İlk', $room->p2_name);
    }

    public function test_normal_join_still_works(): void
    {
        $owner = User::factory()->create();
        Room::create(['code' => 'JAT02', 'p1_token' => 't1', 'p1_user_id' => $owner->id, 'p1_name' => 'Sahip',
            'status' => 'waiting', 'version' => 0]);
        $joiner = User::factory()->create(['nickname' => 'katilan']);
        Sanctum::actingAs($joiner);
        $this->postJson('/api/rooms/JAT02/join', ['token' => 't2', 'name' => 'x'])->assertOk()->assertJsonPath('slot', 'p2');
        $room = Room::where('code', 'JAT02')->first();
        $this->assertSame('playing', $room->status);
        $this->assertSame($joiner->id, (int) $room->p2_user_id);
        $this->assertSame('katilan', $room->p2_name);
    }
}
