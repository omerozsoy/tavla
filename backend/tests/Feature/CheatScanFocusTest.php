<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\CheatScan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// İkinci-ekran (blur) destekleyici sinyali: match_moves.blurred renk eşlemesiyle (rooms p1=white/
// p2=black) kullanıcı-başına toplanır. Rakibin blur'u ve raporlanmayan (null) hamleler sayılmaz.
class CheatScanFocusTest extends TestCase
{
    use RefreshDatabase;

    private function room(string $code, int $p1, int $p2): void
    {
        DB::table('rooms')->insert([
            'code' => $code, 'p1_token' => 'tok'.$p1, 'p1_name' => 'P1',
            'p1_user_id' => $p1, 'p2_user_id' => $p2,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function move(string $code, string $player, ?int $blurred, int $seq): void
    {
        DB::table('match_moves')->insert([
            'room_id' => 1, 'room_code' => $code, 'game_no' => 1, 'seq' => $seq, 'ord' => 0,
            'player' => $player, 'kind' => 'move', 'cube_value' => 1,
            'blurred' => $blurred, 'created_at' => now(),
        ]);
    }

    public function test_counts_blurred_moves_for_user_color_only(): void
    {
        $u = User::factory()->create();
        $this->room('ABCDE', $u->id, 999); // u = p1 => white

        $this->move('ABCDE', 'white', 1, 0);   // blur'lü
        $this->move('ABCDE', 'white', 1, 1);   // blur'lü
        $this->move('ABCDE', 'white', 1, 2);   // blur'lü
        $this->move('ABCDE', 'white', 0, 3);   // temiz
        $this->move('ABCDE', 'black', 1, 4);   // RAKİP — sayılmamalı
        $this->move('ABCDE', 'white', null, 5); // raporlanmadı — sayılmamalı

        $fc = CheatScan::focusSignal($u->id);

        $this->assertNotNull($fc);
        $this->assertSame(4, $fc['reported'], 'yalnız white + raporlı (null hariç)');
        $this->assertSame(3, $fc['blurred']);
        $this->assertSame(75, $fc['pct']);
    }

    public function test_null_when_no_reported_moves(): void
    {
        $u = User::factory()->create();
        $this->assertNull(CheatScan::focusSignal($u->id));
    }
}
