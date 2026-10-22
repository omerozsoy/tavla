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
}
