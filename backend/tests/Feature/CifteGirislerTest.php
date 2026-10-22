<?php

namespace Tests\Feature;

use App\Filament\Pages\CifteGirisler;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Çifte Girişler sayfası: aynı IP'den giren 2+ hesabı shield_presence + sessions birleşiminden bulur.
 */
class CifteGirislerTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n): User
    {
        return User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    public function test_detects_same_ip_multiple_accounts_and_ignores_solo(): void
    {
        $a = $this->user('ali');
        $b = $this->user('veli');
        $c = $this->user('solo');
        foreach ([[$a, '1.2.3.4'], [$b, '1.2.3.4'], [$c, '9.9.9.9']] as [$u, $ip]) {
            DB::table('shield_presence')->insert([
                'subject' => 'u:'.$u->id, 'user_id' => $u->id, 'ip' => $ip,
                'last_seen_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $rows = (new CifteGirisler)->sharedIps();

        $this->assertCount(1, $rows, 'yalnız 2+ hesaplı IP listelenmeli (solo hariç)');
        $this->assertSame('1.2.3.4', $rows[0]['ip']);
        $this->assertSame(2, $rows[0]['count']);
        $this->assertEqualsCanonicalizing([$a->id, $b->id], array_column($rows[0]['users'], 'id'));
    }

    public function test_sessions_table_is_also_a_source(): void
    {
        $a = $this->user('ali');
        $b = $this->user('veli');
        foreach ([$a, $b] as $u) {
            DB::table('sessions')->insert([
                'id' => 'sess-'.$u->id, 'user_id' => $u->id, 'ip_address' => '5.5.5.5',
                'user_agent' => 't', 'payload' => 'x', 'last_activity' => time(),
            ]);
        }

        $rows = (new CifteGirisler)->sharedIps();

        $this->assertCount(1, $rows);
        $this->assertSame('5.5.5.5', $rows[0]['ip']);
        $this->assertSame(2, $rows[0]['count']);
    }

    public function test_flags_matches_between_same_ip_accounts(): void
    {
        $a = $this->user('ali');
        $b = $this->user('veli');
        foreach ([$a, $b] as $u) {
            DB::table('shield_presence')->insert([
                'subject' => 'u:'.$u->id, 'user_id' => $u->id, 'ip' => '1.2.3.4',
                'last_seen_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        // ali vs veli: 2 maç (aynı room_code), ali ikisini de kazandı, 100 coin bahis
        foreach (['R1', 'R2'] as $room) {
            foreach ([[$a, true], [$b, false]] as [$u, $won]) {
                DB::table('match_results')->insert([
                    'user_id' => $u->id, 'won' => $won, 'room_code' => $room, 'match_type' => 'match',
                    'stake' => 100, 'opponent_rating' => 1500, 'rating_before' => 1500,
                    'rating_after' => 1500, 'delta' => 0, 'match_length' => 3, 'pr' => 5.0,
                ]);
            }
        }

        $rows = (new CifteGirisler)->sharedIps();

        $this->assertSame(2, $rows[0]['inter']['count'], 'kendi aralarında 2 maç sayılmalı');
        $pair = $rows[0]['inter']['pairs'][0];
        $this->assertSame(2, $pair['n']);
        $this->assertSame(200, $pair['stake']);
        $aliIsA = $pair['a'] === $a->id;
        $this->assertSame(2, $aliIsA ? $pair['awins'] : $pair['bwins'], 'ali 2 galibiyet');
        $this->assertSame(0, $aliIsA ? $pair['bwins'] : $pair['awins'], 'veli 0 galibiyet');
    }

    public function test_ban_and_unban_ip_toggles_shield_ip_bans_and_flag(): void
    {
        $a = $this->user('ali');
        $b = $this->user('veli');
        foreach ([$a, $b] as $u) {
            DB::table('shield_presence')->insert([
                'subject' => 'u:'.$u->id, 'user_id' => $u->id, 'ip' => '1.2.3.4',
                'last_seen_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $page = new CifteGirisler;

        $page->banIp('1.2.3.4');
        $this->assertDatabaseHas('shield_ip_bans', ['ip' => '1.2.3.4']);
        $this->assertTrue($page->sharedIps()[0]['ip_banned'], 'yasaklı IP ip_banned=true olmalı');

        $page->unbanIp('1.2.3.4');
        $this->assertDatabaseMissing('shield_ip_bans', ['ip' => '1.2.3.4']);
        $this->assertFalse($page->sharedIps()[0]['ip_banned']);
    }
}
