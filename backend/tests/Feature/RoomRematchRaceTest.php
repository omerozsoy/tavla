<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-16: iki taraf rövanşı aynı anda kabul edince her biri bayat kopyadan version+1 yazıyordu: bir
// sürüm artışı kayboluyor (sürüm-kapılı poll cevabı kaçırır), karar bayat veriden veriliyordu.
class RoomRematchRaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_simultaneous_accepts_keep_both_bumps_and_open_room(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        Room::create(['code' => 'RMR01', 'p1_token' => 't1', 'p1_user_id' => $a->id, 'p1_name' => 'A',
            'p2_token' => 't2', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'status' => 'finished',
            'version' => 10, 'server_version' => 10]);

        // Yarış: p1'in isteği odayı OKUDUKTAN hemen sonra p2'nin kabulü commit olur.
        $raced = false;
        Room::retrieved(function (Room $r) use (&$raced) {
            if (! $raced && $r->code === 'RMR01') {
                $raced = true;
                DB::table('rooms')->where('id', $r->id)->update([
                    'rematch_p2' => 'yes', 'version' => 11, 'server_version' => 11,
                ]);
            }
        });

        Sanctum::actingAs($a);
        $res = $this->postJson('/api/rooms/RMR01/rematch', ['token' => 't1', 'accept' => true])->assertOk();

        $room = Room::where('code', 'RMR01')->first();
        // 10 + p2 cevabı + p1 cevabı + rövanş kodu = 13 (eski kod p2'nin artışını ezip 12 yazardı).
        $this->assertSame(13, (int) $room->version, 'iki cevabın sürüm artışı da korunmalı');
        $this->assertSame(13, (int) $room->server_version);
        $this->assertNotEmpty($res->json('rematch.code'), 'iki taraf kabul etti -> yeni oda açılmalı');
        $this->assertSame($res->json('rematch.code'), $room->rematch_code);
    }
}
