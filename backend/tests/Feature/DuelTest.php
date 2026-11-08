<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\DuelService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// BIREYSEL DUELLO: puansız arkadaş-maçı üstüne duel=true. Oda bitince düello galibiyeti yazılır
// (rating'e DOKUNMADAN), bireysel + takım sıralaması türetilir. (bkz App\Support\DuelService)
class DuelTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating = 1500): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating, 'email_verified_at' => now()])->save(); // enter() e-posta gate'i

        return $u;
    }

    // p1 (beyaz) hedefe ulaşmış TAMAMLANMIŞ bir DÜELLO odası (iki gerçek oyuncu).
    private function duelRoom(string $code, User $a, User $b, int $target = 3, string $winner = 'white'): Room
    {
        $wScore = $winner === 'white' ? $target : 0;
        $bScore = $winner === 'white' ? 0 : $target;
        $room = Room::create([
            'code' => $code,
            'p1_token' => 'tA', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => $a->rating,
            'p2_token' => 'tB', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => $b->rating,
            'status' => 'finished', 'mode' => 'friendly', 'unrated' => true, 'duel' => true,
            'time_control' => 'speed', 'target' => $target, 'authoritative' => true,
            'server_match' => ['target' => $target, 'score' => ['white' => $wScore, 'black' => $bScore], 'done' => true, 'winner' => $winner],
            'version' => 3,
        ]);
        Room::where('code', $code)->update(['updated_at' => now()->subMinutes(10)]);

        return $room->refresh();
    }

    // Düello YALNIZ takımlılar arası -> davet eden + hedef bir takıma üye olmalı.
    private function giveTeam(User $u, string $tag): int
    {
        $id = DB::table('teams')->insertGetId([
            'name' => 'Takim'.$tag, 'name_key' => 'takim'.strtolower($tag), 'tag' => $tag, 'tag_key' => strtolower($tag),
            'founder_id' => $u->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
        TeamMember::create(['team_id' => $id, 'user_id' => $u->id, 'role' => 'founder', 'joined_at' => now()]);

        return $id;
    }

    public function test_duel_invite_sets_room_duel_and_unrated(): void
    {
        $a = $this->user('inviter');
        $b = $this->user('invitee');
        $b->forceFill(['last_seen' => now(), 'presence_status' => 'available'])->save();
        $this->giveTeam($a, 'AA'); // düello iki taraf da takımlı olmalı
        $this->giveTeam($b, 'BB');

        Sanctum::actingAs($a);
        $res = $this->postJson("/api/friends/{$b->id}/invite", ['duel' => true, 'target' => 3])->assertOk();
        $code = $res->json('code');
        $this->assertNotNull($code);

        // Davet duel + unrated + potsuz (bet_pct=0) olmalı.
        $inv = DB::table('game_invites')->where('room_code', $code)->first();
        $this->assertTrue((bool) $inv->duel);
        $this->assertTrue((bool) $inv->unrated);
        $this->assertSame(0, (int) $inv->bet_pct);

        // enter() odayı davetten kurar -> duel=true + unrated + friendly.
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tA', 'name' => 'inviter'])->assertOk();
        $room = Room::where('code', $code)->first();
        $this->assertTrue((bool) $room->duel);
        $this->assertTrue((bool) $room->unrated);
        $this->assertSame('friendly', $room->mode);
    }

    public function test_duel_invite_rejects_bad_target(): void
    {
        $a = $this->user('inv2');
        $b = $this->user('tgt2');
        $b->forceFill(['last_seen' => now(), 'presence_status' => 'available'])->save();

        Sanctum::actingAs($a);
        $this->postJson("/api/friends/{$b->id}/invite", ['duel' => true, 'target' => 2])->assertStatus(422);
    }

    public function test_duel_requires_both_players_have_team(): void
    {
        $a = $this->user('dteam1');
        $b = $this->user('dteam2');
        $b->forceFill(['last_seen' => now(), 'presence_status' => 'available'])->save();
        Sanctum::actingAs($a);

        // ikisi de takımsız -> red
        $this->postJson("/api/friends/{$b->id}/invite", ['duel' => true, 'target' => 3])->assertStatus(422);
        // davet eden takımlı, hedef takımsız -> red
        $this->giveTeam($a, 'AA');
        $this->postJson("/api/friends/{$b->id}/invite", ['duel' => true, 'target' => 3])->assertStatus(422);
        // ikisi de takımlı -> başarı
        $this->giveTeam($b, 'BB');
        $this->postJson("/api/friends/{$b->id}/invite", ['duel' => true, 'target' => 3])->assertOk();
    }

    public function test_record_is_idempotent(): void
    {
        $a = $this->user('wa');
        $b = $this->user('wb');
        $room = $this->duelRoom('DUEL1', $a, $b, 3, 'white');

        $svc = app(DuelService::class);
        $svc->record($room);
        $svc->record($room); // ikinci çağrı tek satır bırakmalı (room_code UNIQUE)

        $this->assertSame(1, DB::table('duels')->where('room_code', 'DUEL1')->count());
        $this->assertSame($a->id, (int) DB::table('duels')->where('room_code', 'DUEL1')->value('winner_id'));
    }

    public function test_record_skips_non_duel_and_bot_and_guest(): void
    {
        $a = $this->user('na');
        $b = $this->user('nb');
        $svc = app(DuelService::class);

        // duel=false -> yazmaz
        $r1 = $this->duelRoom('DUEL2', $a, $b, 3, 'white');
        $r1->duel = false;
        $r1->save();
        $svc->record($r1->fresh());
        $this->assertSame(0, DB::table('duels')->where('room_code', 'DUEL2')->count());

        // bot -> yazmaz
        $r2 = $this->duelRoom('DUEL3', $a, $b, 3, 'white');
        $r2->bot = true;
        $r2->save();
        $svc->record($r2->fresh());
        $this->assertSame(0, DB::table('duels')->where('room_code', 'DUEL3')->count());
    }

    public function test_report_rating_writes_duel_without_rating_change(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']); // MatchFinalize/düello kancası bu modda çalışır
        $a = $this->user('ra', 1500);
        $b = $this->user('rb', 1500);
        $this->duelRoom('DUEL4', $a, $b, 3, 'white');

        Sanctum::actingAs($a);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'match_length' => 3, 'room_code' => 'DUEL4',
            'score_self' => 3, 'score_opp' => 0,
        ])->assertOk()->assertJson(['rated' => false]); // puansız

        // Düello yazıldı + kazanan a.
        $this->assertSame($a->id, (int) DB::table('duels')->where('room_code', 'DUEL4')->value('winner_id'));
        // Rating DEĞİŞMEDİ (puansız).
        $this->assertSame(1500, (int) $a->fresh()->rating);
        $this->assertSame(1500, (int) $b->fresh()->rating);
        // match_results satırı puansız (delta 0).
        $row = MatchResult::where('room_code', 'DUEL4')->where('user_id', $a->id)->first();
        $this->assertSame(0, (int) $row->delta);
    }

    public function test_leaderboard_counts_individual_and_team(): void
    {
        $a = $this->user('la');
        $b = $this->user('lb');
        $c = $this->user('lc');
        $svc = app(DuelService::class);

        // a iki düello kazanır (b ve c'ye karşı), b bir kez kaybeder.
        $svc->record($this->duelRoom('L1', $a, $b, 3, 'white'));
        $svc->record($this->duelRoom('L2', $a, $c, 1, 'white'));
        $svc->record($this->duelRoom('L3', $b, $c, 5, 'black')); // c kazanır

        $indiv = DuelService::individualLeaderboard();
        $this->assertSame($a->id, $indiv[0]['user_id']);
        $this->assertSame(2, $indiv[0]['wins']);

        // Takım: a bir takımda, c başka takımda. a=2 galibiyet -> takımı 1., c=1 -> 2.
        $teamA = DB::table('teams')->insertGetId([
            'name' => 'Alfa', 'name_key' => 'alfa', 'tag' => 'AL', 'tag_key' => 'al',
            'founder_id' => $a->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $teamC = DB::table('teams')->insertGetId([
            'name' => 'Ceta', 'name_key' => 'ceta', 'tag' => 'CT', 'tag_key' => 'ct',
            'founder_id' => $c->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
        TeamMember::create(['team_id' => $teamA, 'user_id' => $a->id, 'role' => 'founder', 'joined_at' => now()]);
        TeamMember::create(['team_id' => $teamC, 'user_id' => $c->id, 'role' => 'founder', 'joined_at' => now()]);

        $teams = DuelService::teamLeaderboard();
        $this->assertSame($teamA, $teams[0]['team_id']);
        $this->assertSame(2, $teams[0]['wins']);
        $this->assertSame($teamC, $teams[1]['team_id']);
        $this->assertSame(1, $teams[1]['wins']);
    }
}
