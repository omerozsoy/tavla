<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\DuelService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Silinmiş/anonimleşmiş (UserEraser -> ban_reason='account_deleted', nickname 'silinmisN') hesaplar
 * halka açık GEÇMİŞ-aktivite listelerinde GÖRÜNMEMELİ. Üyelik listeleri (takım/kulüp/arkadaş) silme
 * anında zaten temizlenir; burada kaydı kalan aktivite (düello) listelerinin gösterimde elendiğini kilitle.
 */
class DeletedAccountHiddenTest extends TestCase
{
    use RefreshDatabase;

    private function duel(int $winnerId, int $points, string $code): void
    {
        DB::table('duels')->insert([
            'room_code' => $code, 'player1_id' => $winnerId, 'player2_id' => $winnerId + 1000,
            'winner_id' => $winnerId, 'target_points' => $points,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_deleted_winner_dropped_from_duel_individual_leaderboard(): void
    {
        $live = User::factory()->create(['nickname' => 'canli']);
        $gone = User::factory()->create(['nickname' => 'eski']);

        $this->duel($live->id, 5, 'AAA');
        $this->duel($gone->id, 3, 'BBB');

        // 'gone' hesabını anonimleştir (UserEraser deseni).
        $gone->forceFill(['nickname' => 'silinmis'.$gone->id, 'ban_reason' => 'account_deleted', 'banned_at' => now()])->save();

        $board = DuelService::individualLeaderboard();
        $ids = array_column($board, 'user_id');

        $this->assertContains($live->id, $ids);
        $this->assertNotContains($gone->id, $ids); // silinmiş kazanan listeden TAMAMEN düştü
    }
}
