<?php

namespace Tests\Feature;

use App\Filament\Resources\MatchResultResource;
use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Yönetim paneli "Maç Geçmişi": online maç iki satır üretir (oyuncu-başına PR),
 * tabloda oda koduna göre TEK kanonik satır (en küçük id) gösterilir; oda kodsuz
 * (pvb/yerel/eski) satırlar dokunulmadan kalır.
 */
class MatchHistoryDedupeTest extends TestCase
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

    private function mr(User $u, ?string $room, bool $won): MatchResult
    {
        return MatchResult::create([
            'user_id' => $u->id, 'won' => $won,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => 3, 'match_type' => 'match', 'pr' => 5.0, 'room_code' => $room,
        ]);
    }

    public function test_online_match_collapses_to_single_row_per_room(): void
    {
        $a = $this->user('ahmet');
        $b = $this->user('mehmet');

        // Online maç: aynı room_code, iki oyuncu satırı.
        $rowA = $this->mr($a, 'ROOM1', true);
        $this->mr($b, 'ROOM1', false);

        // İkinci online maç, farklı oda.
        $rowA2 = $this->mr($a, 'ROOM2', false);
        $this->mr($b, 'ROOM2', true);

        // pvb (oda yok) — iki ayrı satır, ikisi de kalmalı.
        $pvb1 = $this->mr($a, null, true);
        $pvb2 = $this->mr($a, null, false);

        $ids = MatchResultResource::dedupeOnlineRows(MatchResult::query())
            ->pluck('id')->sort()->values()->all();

        // Her odadan yalnız kanonik (en küçük id) + iki pvb satırı.
        $this->assertEqualsCanonicalizing(
            [$rowA->id, $rowA2->id, $pvb1->id, $pvb2->id],
            $ids
        );
        $this->assertCount(4, $ids);
    }

    public function test_filters_still_and_correctly_after_dedupe(): void
    {
        $a = $this->user('ahmet');
        $b = $this->user('mehmet');
        $win = $this->mr($a, 'ROOM1', true);   // kanonik satır: galibiyet
        $this->mr($b, 'ROOM1', false);

        // Dedupe + won=true filtresi birlikte: yalnız kazanan kanonik satır.
        $ids = MatchResultResource::dedupeOnlineRows(MatchResult::query())
            ->where('won', true)
            ->pluck('id')->all();

        $this->assertSame([$win->id], $ids);
    }
}
