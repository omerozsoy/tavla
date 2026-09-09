<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// SUNUCU-OTORİTER YEDEK: tamamlanmış online maçta istemcisi reportRating'i yapamamış
// (sekme kapandı / ağ) oyuncuların match_results satırı sunucuda tamamlanır -> maç HER İKİ
// oyuncunun "Maç Analizleri" listesinde çıkar. (bkz App\Support\MatchBackstop)
class MatchBackstopTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating = 1500): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating])->save(); // rating fillable degil
        return $u;
    }

    // Beyaz (p1) hedefe ulasmis TAMAMLANMIS bir oda. İki istemci de RAPORLAMAMIS.
    private function completedRoom(string $code, User $a, User $b, string $mode = 'ranked', int $whiteScore = 1, int $blackScore = 0): Room
    {
        $room = Room::create([
            'code' => $code,
            'p1_token' => 'tA', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => $a->rating,
            'p2_token' => 'tB', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => $b->rating,
            'status' => 'finished', 'mode' => $mode, 'time_control' => 'speed', 'target' => 1,
            'version' => 3,
            'state' => [
                'match' => ['target' => 1, 'cube' => ['value' => 1, 'owner' => null], 'score' => ['white' => $whiteScore, 'black' => $blackScore]],
                'turnStart' => ['turn' => 'white'], 'played' => [], 'starter' => 'white', 'turnsPlayed' => 4,
            ],
        ]);
        // updated_at'i grace penceresinin GERISINE it (10 dk once) -> sweep bu odayi tarar.
        Room::where('code', $code)->update(['updated_at' => now()->subMinutes(10)]);

        return $room->refresh();
    }

    // TAMAMLANMIS mac + hic rapor yok -> sweep HER IKI oyuncu icin satir yazar (kazanan + kaybeden).
    public function test_backstop_records_both_players(): void
    {
        $a = $this->user('a'); // beyaz/p1 -> kazanan
        $b = $this->user('b'); // siyah/p2 -> kaybeden
        $this->completedRoom('BS1', $a, $b);

        Artisan::call('matches:backstop-finished');

        $rowA = MatchResult::where('room_code', 'BS1')->where('user_id', $a->id)->first();
        $rowB = MatchResult::where('room_code', 'BS1')->where('user_id', $b->id)->first();
        $this->assertNotNull($rowA, 'kazanan satiri yazilmali');
        $this->assertNotNull($rowB, 'kaybeden satiri yazilmali');
        $this->assertTrue((bool) $rowA->won);
        $this->assertFalse((bool) $rowB->won);
        // Skorlar odadan (otoriter) yazilmali.
        $this->assertSame(1, (int) $rowA->score_self);
        $this->assertSame(0, (int) $rowA->score_opp);
        $this->assertSame(0, (int) $rowB->score_self);
        $this->assertSame(1, (int) $rowB->score_opp);
        // Rating: kazanan artar, kaybeden azalir (k=32, esit rating -> +-16).
        $a->refresh();
        $b->refresh();
        $this->assertSame(1516, (int) $a->rating);
        $this->assertSame(1484, (int) $b->rating);
        $this->assertSame(1, (int) $a->wins);
        $this->assertSame(1, (int) $b->losses);
        // Bare satir: analiz log'u yok (istemci raporlamadi).
        $this->assertEmpty($rowA->log);
    }

    // Sweep IDEMPOTENT: istemci ZATEN raporladiysa (zengin satir) ust-uste yazmaz / EZMEZ.
    public function test_backstop_is_idempotent_and_preserves_client_row(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $this->completedRoom('BS2', $a, $b);

        // Kazananin (A) istemcisi ZATEN raporlamis: zengin (log'lu) satir + rating uygulanmis.
        $a->forceFill(['rating' => 1516, 'wins' => 1, 'games_played' => 1])->save();
        MatchResult::create([
            'user_id' => $a->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 1, 'pr' => 3.5, 'coins_after' => 0, 'room_code' => 'BS2',
            'log' => '{"hc":"white","log":[{"player":"white"}]}',
        ]);

        Artisan::call('matches:backstop-finished');

        // A: hala TEK satir, log korundu, rating degismedi (cift-Elo yok).
        $this->assertSame(1, MatchResult::where('room_code', 'BS2')->where('user_id', $a->id)->count());
        $a->refresh();
        $this->assertSame(1516, (int) $a->rating);
        // B: eksikti -> sweep yazdi.
        $this->assertNotNull(MatchResult::where('room_code', 'BS2')->where('user_id', $b->id)->first());
    }

    // Sonuc KESIN degilse (yarim kalan mac, hedefe ulasilmamis) HICBIR satir yazilmaz.
    public function test_backstop_skips_undecided_match(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        // 0-0: hedefe (1) ulasilmamis -> resolve null.
        $room = $this->completedRoom('BS3', $a, $b, 'ranked', 0, 0);
        // Durumu 'playing' yap (yarida terk edilmis gibi) -> yine yazilmamali.
        Room::where('code', 'BS3')->update(['status' => 'playing']);

        Artisan::call('matches:backstop-finished');

        $this->assertSame(0, MatchResult::where('room_code', 'BS3')->count());
    }

    // Arkadaslik (friendly): satir YAZILIR (gecmiste gorunsun) ama rating/istatistik DEGISMEZ.
    public function test_backstop_friendly_records_without_rating_change(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $this->completedRoom('BS4', $a, $b, 'friendly');

        Artisan::call('matches:backstop-finished');

        $rowA = MatchResult::where('room_code', 'BS4')->where('user_id', $a->id)->first();
        $this->assertNotNull($rowA);
        $this->assertSame(0, (int) $rowA->delta);
        $a->refresh();
        $this->assertSame(1500, (int) $a->rating);       // rating degismedi
        $this->assertSame(0, (int) $a->wins);            // istatistik degismedi
        $this->assertSame(0, (int) $a->games_played);
    }

    // GEC gelen istemci raporu: bare yedek satiri log/PR ile ZENGINLESTIRIR (rating'e dokunmadan).
    public function test_late_client_report_enriches_bare_row(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $this->completedRoom('BS5', $a, $b);

        // Once sweep bare satir yazsin.
        Artisan::call('matches:backstop-finished');
        $bare = MatchResult::where('room_code', 'BS5')->where('user_id', $a->id)->first();
        $this->assertNotNull($bare);
        $this->assertEmpty($bare->log);
        $a->refresh();
        $ratingAfterBackstop = (int) $a->rating;

        // A'nin istemcisi GEC raporlar (log'lu). Rating TEKRAR uygulanmamali; log islenmelidir.
        Sanctum::actingAs($a);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'match_length' => 1, 'ranked' => true, 'room_code' => 'BS5',
            'score_self' => 1, 'score_opp' => 0,
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'loss' => 0.02, 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.02],
            ]]),
        ])->assertOk();

        $bare->refresh();
        $this->assertNotEmpty($bare->log);                 // log islendi -> analiz edilebilir
        $this->assertSame(1, MatchResult::where('room_code', 'BS5')->where('user_id', $a->id)->count());
        $a->refresh();
        $this->assertSame($ratingAfterBackstop, (int) $a->rating); // rating degismedi (cift-Elo yok)
    }
}
