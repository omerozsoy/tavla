<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Turnuva "gelmeme" (walkover): rakip 1dk icinde odaya girmezse cagiran hukmen kazanir.
class TournamentNoShowTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    // 4 oyunculu bracket: yari-final maci (kazanan finale ilerler; sampiyon/prize yolu disi).
    private function tournament(User $a, User $b, User $c, User $d): Tournament
    {
        return Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running',
            'players' => [
                ['id' => $a->id, 'name' => 'A'], ['id' => $b->id, 'name' => 'B'],
                ['id' => $c->id, 'name' => 'C'], ['id' => $d->id, 'name' => 'D'],
            ],
            'bracket' => [
                [ // round 0
                    ['key' => 'm0', 'p1' => ['id' => $a->id, 'name' => 'A'], 'p2' => ['id' => $b->id, 'name' => 'B']],
                    ['key' => 'm1', 'p1' => ['id' => $c->id, 'name' => 'C'], 'p2' => ['id' => $d->id, 'name' => 'D']],
                ],
                [ // round 1 (final) — bos
                    ['key' => 'f0', 'p1' => null, 'p2' => null],
                ],
            ],
        ]);
    }

    // A odaya girer, B hic gelmez, 1dk gecince A hukmen kazanir -> finale ilerler.
    public function test_no_show_awards_walkover_after_deadline(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $c = $this->user('c');
        $d = $this->user('d');
        $t = $this->tournament($a, $b, $c, $d);

        // A maci acar (oda kodu) ve odaya girer (p1).
        Sanctum::actingAs($a);
        $code = $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'm0'])
            ->assertOk()->json('code');
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tokA', 'name' => 'A'])->assertOk();

        // Sure DOLMADAN: hukmen reddedilir.
        $this->postJson("/api/tournaments/{$t->id}/no-show", ['match' => 'm0', 'token' => 'tokA'])
            ->assertStatus(422);

        // Odayi 61sn geriye it (1dk gelmeme suresi doldu).
        $room = Room::where('code', $code)->first();
        $room->created_at = now()->subSeconds(61);
        $room->save();

        // Artik hukmen kazanilir -> A finale (round1[0].p1) tasinir.
        $this->postJson("/api/tournaments/{$t->id}/no-show", ['match' => 'm0', 'token' => 'tokA'])
            ->assertOk();

        $t->refresh();
        $this->assertSame($a->id, $t->bracket[0][0]['winner']);
        $this->assertSame($a->id, $t->bracket[1][0]['p1']['id']); // finale ilerledi
        Room::where('code', $code)->first()->refresh();
        $this->assertSame('NO_SHOW', Room::where('code', $code)->first()->end_reason);
    }

    // Rakip odaya GIRDIYSE hukmen YOK (oynasinlar).
    public function test_no_show_rejected_when_opponent_present(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $c = $this->user('c');
        $d = $this->user('d');
        $t = $this->tournament($a, $b, $c, $d);

        Sanctum::actingAs($a);
        $code = $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'm0'])
            ->assertOk()->json('code');
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tokA', 'name' => 'A'])->assertOk();
        // B de girer -> oda dolu
        Sanctum::actingAs($b);
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tokB', 'name' => 'B'])->assertOk();

        $room = Room::where('code', $code)->first();
        $room->created_at = now()->subSeconds(61);
        $room->save();

        // Rakip girdigi icin (slot token dolu) hukmen reddedilir.
        $this->postJson("/api/tournaments/{$t->id}/no-show", ['match' => 'm0', 'token' => 'tokA'])
            ->assertStatus(422);
        $t->refresh();
        $this->assertArrayNotHasKey('winner', $t->bracket[0][0]); // sonuc girilmedi
    }

    // IKI oyuncu da gelmezse (kimse odaya girmez) turnuva TAKILMAZ: ready_at + match_stall_minutes
    // dk sonra sunucu rating ile ilerletir (yuksek rating finale), kimse elle tetiklemese de.
    public function test_double_no_show_resolved_by_rating_after_deadline(): void
    {
        config(['tournament.match_stall_minutes' => 3]);
        $a = $this->user('a');
        $b = $this->user('b');
        $c = $this->user('c');
        $d = $this->user('d');
        $t = $this->tournament($a, $b, $c, $d);
        // Fixture duz id/name; rating'i bracket'e koy (stalled cozumu bracket rating'ini okur).
        $br = $t->bracket;
        $br[0][0]['p1']['rating'] = 1600;
        $br[0][0]['p2']['rating'] = 1400;
        $t->bracket = $br;
        $t->save();

        Sanctum::actingAs($a);
        // 1. poll: maci HAZIR gorup ready_at damgalar (henuz cozmez).
        $this->getJson('/api/tournaments')->assertOk();
        $t->refresh();
        $this->assertArrayHasKey('ready_at', $t->bracket[0][0]);
        $this->assertArrayNotHasKey('winner', $t->bracket[0][0]);

        // ready_at'i 4 dk geriye it (stall 3 dk doldu).
        $br = $t->bracket;
        $br[0][0]['ready_at'] = now()->subMinutes(4)->toIso8601String();
        $t->bracket = $br;
        $t->save();

        // 2. poll: kimse gelmedigi icin rating ile cozulur -> yuksek rating (a) finale.
        $this->getJson('/api/tournaments')->assertOk();
        $t->refresh();
        $this->assertSame($a->id, $t->bracket[0][0]['winner']);
        $this->assertSame(['no_show' => true], $t->bracket[0][0]['score']);
        $this->assertSame($a->id, $t->bracket[1][0]['p1']['id']); // finale ilerledi
    }

    // TEK taraf odaya girip otekinin gelmemesi: oyuncu "no-show"a basmasa bile sure dolunca
    // sunucu otomatik hukmen verir (giren kazanir, finale ilerler).
    public function test_one_present_auto_walkover_after_deadline(): void
    {
        config(['tournament.match_stall_minutes' => 3]);
        $a = $this->user('a');
        $b = $this->user('b');
        $c = $this->user('c');
        $d = $this->user('d');
        $t = $this->tournament($a, $b, $c, $d);

        Sanctum::actingAs($a);
        $code = $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'm0'])
            ->assertOk()->json('code');
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tokA', 'name' => 'A'])->assertOk();

        // ready_at damgalansin.
        $this->getJson('/api/tournaments')->assertOk();
        $t->refresh();
        $this->assertArrayHasKey('ready_at', $t->bracket[0][0]);

        // Sure doldur.
        $br = $t->bracket;
        $br[0][0]['ready_at'] = now()->subMinutes(4)->toIso8601String();
        $t->bracket = $br;
        $t->save();

        // Poll: a girdigi/b girmedigi icin a hukmen -> finale. Elle no-show cagrilmadi.
        $this->getJson('/api/tournaments')->assertOk();
        $t->refresh();
        $this->assertSame($a->id, $t->bracket[0][0]['winner']);
        $this->assertSame($a->id, $t->bracket[1][0]['p1']['id']);
    }
}
