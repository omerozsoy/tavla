<?php

namespace Tests\Feature;

use App\Models\MatchMove;
use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// YÖNETİCİ "maçtan at" (ADMIN_KICK): izlenen canlı maçta admin bir oyuncuyu hükmen attırır ->
// atılan KAYBEDER (rating + mağlubiyet + match_results satırı), rakip normal forfeit gibi kazanır.
class AdminForfeitTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating = 1500, bool $admin = false): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating, 'is_admin' => $admin])->save();

        return $u;
    }

    private function rankedRoom(string $code, User $a, User $b): Room
    {
        return Room::create([
            'code' => $code,
            'p1_token' => 'tA', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => $a->rating,
            'p2_token' => 'tB', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => $b->rating,
            'status' => 'playing', 'mode' => 'ranked', 'time_control' => 'speed', 'target' => 1,
            'version' => 1,
        ]);
    }

    // ÇEKİRDEK: admin p1'i (A) atar -> A rating düşer + mağlubiyet + satır(won=false); oda biter.
    public function test_admin_kick_makes_player_lose_points(): void
    {
        $admin = $this->user('adm', 1500, true);
        $a = $this->user('a');
        $b = $this->user('b');
        $this->rankedRoom('AK1', $a, $b);

        Sanctum::actingAs($admin);
        $res = $this->postJson('/api/rooms/AK1/admin-forfeit', ['loser_user_id' => $a->id]);
        $res->assertOk()->assertJsonPath('winner', 'black'); // rakip (p2/siyah) kazanan

        $a->refresh();
        $this->assertLessThan(1500, (int) $a->rating);   // puan kaybı
        $this->assertSame(1, (int) $a->losses);
        $row = MatchResult::where('room_code', 'AK1')->where('user_id', $a->id)->first();
        $this->assertNotNull($row);
        $this->assertFalse((bool) $row->won);

        $room = Room::where('code', 'AK1')->first();
        $this->assertSame('finished', $room->status);
        $this->assertSame('ADMIN_KICK', $room->end_reason);

        // Rakip (B) sunucuda YAZILMAZ (kendi client'i raporlar) -> satırı yok.
        $this->assertNull(MatchResult::where('room_code', 'AK1')->where('user_id', $b->id)->first());
    }

    // FORCE: rakip HİÇ oynamamış olsa bile (normalde ghost-win no-contest) atılan yine kaybeder.
    public function test_force_records_loss_even_when_opponent_never_played(): void
    {
        $admin = $this->user('adm', 1500, true);
        $a = $this->user('a'); // beyaz (p1) -> OYNADI
        $b = $this->user('b'); // siyah (p2) -> hiç oynamadı
        $room = $this->rankedRoom('AK2', $a, $b);

        // Yalnız beyaz (atılacak olan) oynadı: ghost-win kalkanı normalde no-contest'e indirirdi.
        MatchMove::create([
            'room_id' => $room->id, 'room_code' => 'AK2', 'game_no' => 1, 'seq' => 1, 'ord' => 0,
            'player' => 'white', 'kind' => 'move',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson('/api/rooms/AK2/admin-forfeit', ['loser_user_id' => $a->id])->assertOk();

        $a->refresh();
        $this->assertLessThan(1500, (int) $a->rating); // force sayesinde puan kaybı YİNE uygulandı
        $this->assertSame(1, (int) $a->losses);
        $this->assertFalse((bool) MatchResult::where('room_code', 'AK2')->where('user_id', $a->id)->first()->won);
    }

    // Atılan oyuncuya "maçtan çıkarıldınız" bildirimi düşer.
    public function test_kicked_player_gets_notification(): void
    {
        $admin = $this->user('adm', 1500, true);
        $a = $this->user('a');
        $b = $this->user('b');
        $this->rankedRoom('AK3', $a, $b);

        Sanctum::actingAs($admin);
        $this->postJson('/api/rooms/AK3/admin-forfeit', [
            'loser_user_id' => $a->id, 'reason' => 'küfür',
        ])->assertOk();

        $this->assertDatabaseHas('notifications', ['user_id' => $a->id, 'title' => 'Maçtan çıkarıldınız']);
    }

    // Admin olmayan kullanıcı atamaz (403 — 'admin' middleware).
    public function test_non_admin_cannot_kick(): void
    {
        $u = $this->user('u');
        $a = $this->user('a');
        $b = $this->user('b');
        $this->rankedRoom('AK4', $a, $b);

        Sanctum::actingAs($u);
        $this->postJson('/api/rooms/AK4/admin-forfeit', ['loser_user_id' => $a->id])->assertStatus(403);

        $a->refresh();
        $this->assertSame(1500, (int) $a->rating); // dokunulmadı
    }

    // Maçta olmayan oyuncu atılamaz (422).
    public function test_cannot_kick_player_not_in_match(): void
    {
        $admin = $this->user('adm', 1500, true);
        $a = $this->user('a');
        $b = $this->user('b');
        $outsider = $this->user('x');
        $this->rankedRoom('AK5', $a, $b);

        Sanctum::actingAs($admin);
        $this->postJson('/api/rooms/AK5/admin-forfeit', ['loser_user_id' => $outsider->id])->assertStatus(422);
    }

    // Zaten bitmiş maç -> 409 (idempotent güvenlik).
    public function test_finished_match_rejected(): void
    {
        $admin = $this->user('adm', 1500, true);
        $a = $this->user('a');
        $b = $this->user('b');
        $room = $this->rankedRoom('AK6', $a, $b);
        $room->forceFill(['status' => 'finished'])->save();

        Sanctum::actingAs($admin);
        $this->postJson('/api/rooms/AK6/admin-forfeit', ['loser_user_id' => $a->id])->assertStatus(409);
    }
}
