<?php

namespace Tests\Feature;

use App\Filament\Resources\MatchResultResource\Pages\ViewMatchResult;
use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Maç detay skorbordu (ViewMatchResult::summaryData): gösterilen PR gnubg (yetkili) değeridir;
 * "iki PR" uyarısı YALNIZ kayıtlı istemci pr'ı gnubg'den gerçekten farklıysa çıkar.
 */
class MatchSummaryDataTest extends TestCase
{
    use RefreshDatabase;

    private function row(array $attrs): MatchResult
    {
        // gnubg_pr motor tarafından yazılır ($fillable değil) -> create'ten ayır, forceFill ile yaz.
        $gnubg = $attrs['gnubg_pr'] ?? null;
        unset($attrs['gnubg_pr']);

        $row = MatchResult::create(array_merge([
            'user_id' => User::factory()->create()->id,
            'won' => false,
            'opponent_name' => 'Rakip',
            'opponent_rating' => 1500,
            'rating_before' => 1500,
            'rating_after' => 1500,
            'delta' => 0,
            'match_length' => 5,
        ], $attrs));

        if ($gnubg !== null) {
            $row->forceFill(['gnubg_pr' => $gnubg])->save();
        }

        return $row;
    }

    public function test_equal_prs_show_single_pr_without_mismatch(): void
    {
        $d = ViewMatchResult::summaryData($this->row(['pr' => 11.58, 'gnubg_pr' => 11.58]));

        $this->assertSame(11.58, (float) $d['self']['pr']);   // gösterilen = gnubg
        $this->assertFalse($d['pr_mismatch']);                // tek PR, uyarı yok
    }

    public function test_divergent_client_pr_flags_mismatch(): void
    {
        $d = ViewMatchResult::summaryData($this->row(['pr' => 25.0, 'gnubg_pr' => 11.58]));

        $this->assertSame(11.58, (float) $d['self']['pr']);   // gnubg yetkili
        $this->assertTrue($d['pr_mismatch']);                 // fark -> uyarı
    }

    public function test_falls_back_to_client_pr_when_gnubg_missing(): void
    {
        $d = ViewMatchResult::summaryData($this->row(['pr' => 9.0, 'gnubg_pr' => null]));

        $this->assertSame(9.0, (float) $d['self']['pr']);     // gnubg yoksa kayıtlı pr
        $this->assertFalse($d['pr_mismatch']);                // tek değer -> uyarı yok
    }
}
