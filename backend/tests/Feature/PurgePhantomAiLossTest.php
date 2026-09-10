<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Oynanmadan olusan hayalet AI kaybi" temizleme komutu (tavla:purge-phantom-ai).
 *
 * KRITIK yeni kapsam: acilis zari bota (siyah) baslama hakki verirse bot ONCE oynar ->
 * log botun hamlesiyle DOLAR ama insan (beyaz) yine hic oynamamistir. Eski "LENGTH(log)<=40"
 * sezgisi bunu KACIRIYORDU; yeni detektor (log'da player===hc yok) yakalar.
 */
class PurgePhantomAiLossTest extends TestCase
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

    /** @param array<int,array{player:string}> $log */
    private function mr(User $u, bool $won, ?string $room, ?array $log, string $hc = 'white'): MatchResult
    {
        return MatchResult::create([
            'user_id' => $u->id, 'won' => $won,
            'opponent_rating' => 1000, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => 5, 'match_type' => 'ai', 'pr' => null, 'room_code' => $room,
            'log' => $log === null ? null : json_encode(['hc' => $hc, 'log' => $log]),
        ]);
    }

    public function test_purges_phantom_but_keeps_real_and_online(): void
    {
        $u = $this->user('omer');

        // (1) HAYALET: hic hamle yok (bos log) -> silinir.
        $emptyLog = $this->mr($u, false, null, []);
        // (2) HAYALET: bot ONCE oynadi, insan cikti (log yalniz siyah) -> silinir (yeni kapsam).
        $botFirst = $this->mr($u, false, null, [['player' => 'black'], ['player' => 'black']]);
        // (3) HAYALET: log NULL -> silinir.
        $nullLog = $this->mr($u, false, null, null);

        // (4) GERCEK: insan (beyaz) oynadi -> KALIR.
        $realLoss = $this->mr($u, false, null, [['player' => 'black'], ['player' => 'white']]);
        // (5) GERCEK kazanma (won=true) -> filtre disinda, KALIR.
        $realWin = $this->mr($u, true, null, [['player' => 'black']]);
        // (6) ONLINE (room_code var) -> DOKUNULMAZ.
        $online = $this->mr($u, false, 'ROOM9', []);

        $this->artisan('tavla:purge-phantom-ai', ['--email' => 'omer@example.com'])
            ->assertExitCode(0);

        // Hayaletler gitti.
        $this->assertNull(MatchResult::find($emptyLog->id));
        $this->assertNull(MatchResult::find($botFirst->id));
        $this->assertNull(MatchResult::find($nullLog->id));
        // Gercek/online kaldi.
        $this->assertNotNull(MatchResult::find($realLoss->id));
        $this->assertNotNull(MatchResult::find($realWin->id));
        $this->assertNotNull(MatchResult::find($online->id));
    }

    public function test_dry_run_deletes_nothing(): void
    {
        $u = $this->user('ayse');
        $ph = $this->mr($u, false, null, [['player' => 'black']]);

        $this->artisan('tavla:purge-phantom-ai', ['--email' => 'ayse@example.com', '--dry-run' => true])
            ->assertExitCode(0);

        $this->assertNotNull(MatchResult::find($ph->id)); // dry-run -> durur
    }
}
