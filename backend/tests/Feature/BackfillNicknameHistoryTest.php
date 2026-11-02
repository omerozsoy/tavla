<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BackfillNicknameHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_old_nicknames_are_backfilled_from_match_snapshots(): void
    {
        $user = User::factory()->create(['nickname' => 'yeniAd']);

        // Bu üyeye karşı oynanan maçlarda kayıtlı eski rakip adları (snapshot).
        foreach ([['eskiAd', '2026-01-01 10:00:00'], ['eskiAd', '2026-02-01 10:00:00'], ['dahaEski', '2025-06-01 10:00:00'], ['yeniAd', '2026-03-01 10:00:00']] as [$nick, $at]) {
            DB::table('match_results')->insert([
                'user_id' => User::factory()->create()->id,
                'opponent_user_id' => $user->id,
                'opponent_name' => $nick,
                'won' => true,
                'opponent_rating' => 1500,
                'rating_before' => 1500,
                'rating_after' => 1510,
                'delta' => 10,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        }

        $this->artisan('tavla:backfill-nickname-history')->assertSuccessful();

        $hist = $user->fresh()->nickname_history;
        // Şimdiki ad (yeniAd) hariç, kronolojik: dahaEski -> eskiAd. eskiAd 'at' = SON görülme (2026-02).
        $this->assertSame(['dahaEski', 'eskiAd'], array_column($hist, 'nickname'));
        $this->assertSame('2026-02-01 10:00:00', $hist[1]['at']);

        // İkinci çalıştırma idempotent (tekrar eklemez).
        $this->artisan('tavla:backfill-nickname-history')->assertSuccessful();
        $this->assertCount(2, $user->fresh()->nickname_history);
    }

    public function test_name_belonging_to_another_active_user_is_not_attributed(): void
    {
        $victim = User::factory()->create(['nickname' => 'kurban']);
        // 'baskasi' BAŞKA aktif üyenin şimdiki nick'i -> yanlış opponent_user_id eşleşmesi.
        User::factory()->create(['nickname' => 'baskasi']);

        DB::table('match_results')->insert([
            'user_id' => User::factory()->create()->id,
            'opponent_user_id' => $victim->id,
            'opponent_name' => 'baskasi',
            'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1510, 'delta' => 10,
            'created_at' => '2026-01-01 10:00:00', 'updated_at' => '2026-01-01 10:00:00',
        ]);

        $this->artisan('tavla:backfill-nickname-history')->assertSuccessful();
        $this->assertNull($victim->fresh()->nickname_history);
    }

    public function test_deleted_account_is_excluded_and_purged(): void
    {
        // KVKK silinmiş hesap: gerçek adı match snapshot'ında + yanlışlıkla history'ye yazılmış.
        $deleted = User::factory()->create([
            'nickname' => 'silinmis5',
            'ban_reason' => 'account_deleted',
            'nickname_history' => [['nickname' => 'gercekisim', 'at' => '2026-01-01 00:00:00', 'backfill' => true]],
        ]);
        DB::table('match_results')->insert([
            'user_id' => User::factory()->create()->id,
            'opponent_user_id' => $deleted->id,
            'opponent_name' => 'gercekisim',
            'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1510, 'delta' => 10,
            'created_at' => '2026-01-01 10:00:00', 'updated_at' => '2026-01-01 10:00:00',
        ]);

        $this->artisan('tavla:backfill-nickname-history')->assertSuccessful();

        // Hem temizlenmiş hem tekrar yazılmamış.
        $this->assertNull($deleted->fresh()->nickname_history);
    }
}
