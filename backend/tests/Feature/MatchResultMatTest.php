<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MatchResult::matText() maçın log'undan XG uyumlu .mat üretmeli (admin maç detay sayfası).
 * Kaynak = match_results.log ({hc, log}); MatBuilder ile aynı ispatlı yol.
 */
class MatchResultMatTest extends TestCase
{
    use RefreshDatabase;

    public function test_mattext_builds_mat_from_single_log(): void
    {
        $mr = MatchResult::create([
            'user_id' => User::factory()->create()->id,
            'won' => true,
            'opponent_name' => 'Rakip',
            'opponent_rating' => 1500,
            'rating_before' => 1500,
            'rating_after' => 1512,
            'delta' => 12,
            'match_length' => 1,
            'log' => json_encode([
                'hc' => 'white',
                'log' => [
                    ['player' => 'white', 'notation' => '8/5 6/5', 'dice' => [3, 1], 'seq' => 0],
                    ['player' => 'black', 'notation' => '24/21 13/11', 'dice' => [3, 2], 'seq' => 0],
                ],
            ]),
        ]);

        $mat = $mr->matText();

        $this->assertStringContainsString('1 point match', $mat);
        $this->assertStringContainsString('8/5 6/5', $mat);
        $this->assertStringContainsString('24/21 13/11', $mat);
        $this->assertStringContainsString('tavlatv-mac-'.$mr->id.'.mat', $mr->matFilename());
    }

    public function test_mattext_empty_when_no_log(): void
    {
        $mr = MatchResult::create([
            'user_id' => User::factory()->create()->id,
            'won' => false,
            'opponent_rating' => 1500,
            'rating_before' => 1500,
            'rating_after' => 1488,
            'delta' => -12,
            'match_length' => 1,
        ]);

        $this->assertSame('', $mr->matText());
    }
}
