<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeMatchLuckJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

// Tavlai Luck V1: AnalyzeMatchLuckJob gnubg NATIVE luck'ı (.mat -> analyse match) per-oyuncu
// MWC%'ye yazar. KRİTİK: .mat sütun 0 = white, sütun 1 = black -> her satıra KENDİ renginin
// luck'ı gitmeli (log.hc ile eşlenir). İki satır da (aynı oda) idempotent güncellenir.
class AnalyzeMatchLuckJobTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n): User
    {
        return User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
    }

    public function test_maps_columns_to_colors_and_syncs_both_rows(): void
    {
        $w = $this->user('wl');
        $b = $this->user('bl');
        // Beyaz oyuncunun satırı (log.hc=white) + siyah oyuncunun satırı (log.hc=black), aynı oda.
        $base = ['opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0];
        $wRow = MatchResult::create($base + [
            'user_id' => $w->id, 'won' => true, 'room_code' => 'LK1',
            'log' => json_encode(['hc' => 'white', 'log' => []]),
        ]);
        $bRow = MatchResult::create($base + [
            'user_id' => $b->id, 'won' => false, 'room_code' => 'LK1',
            'log' => json_encode(['hc' => 'black', 'log' => []]),
        ]);

        // gnubg: p0 (white) = +39.0% / +0.78 ; p1 (black) = -13.0% / -0.26
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldReceive('matchluck')->once()->andReturn([
            'import_cmd' => 'import mat',
            'luck' => [
                'names' => ['White', 'Black'],
                'p0' => ['mwc_total' => 39.0, 'emg_total' => 0.78],
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26],
            ],
        ]);

        (new AnalyzeMatchLuckJob($wRow->id, "1 point match\n Game 1\n"))->handle($mock);

        $wRow->refresh();
        $bRow->refresh();
        // Beyaz satırı white (p0) luck'ını almalı; siyah satırı black (p1).
        $this->assertEqualsWithDelta(39.0, (float) $wRow->luck_mwc, 1e-6);
        $this->assertEqualsWithDelta(0.78, (float) $wRow->luck_emg, 1e-6);
        $this->assertEqualsWithDelta(-13.0, (float) $bRow->luck_mwc, 1e-6);
        $this->assertSame('TAVLAI_LUCK_V1', $wRow->luck_method);
        $this->assertSame('TAVLAI_LUCK_V1', $bRow->luck_method);
    }

    // KRİTİK: "biri 0" bug'ının çözümü. Bir istemcinin kısmi .mat'i bir oyuncuya emg=0 (imkânsız)
    // verirse, o ŞÜPHELİ 0 GERÇEK değeri EZMEMELİ (kendi satırı) ve boş olmayan rakip satırına
    // yazılmamalı. Böylece her oyuncunun luck'ı kendi güvenilir .mat'inden gelir.
    public function test_suspicious_zero_does_not_overwrite_real(): void
    {
        $w = $this->user('ws');
        $b = $this->user('bs');
        $base = ['opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0];
        // Beyaz satırı ZATEN gerçek değere sahip (kendi iyi raporundan gelmiş gibi).
        // luck_mwc fillable DEĞİL -> query-builder ile koy (job da öyle yazar).
        $wRow = MatchResult::create($base + [
            'user_id' => $w->id, 'won' => true, 'room_code' => 'LKS',
            'log' => json_encode(['hc' => 'white', 'log' => []]),
        ]);
        MatchResult::where('id', $wRow->id)->update(['luck_mwc' => 5.0, 'luck_emg' => 0.10]);
        $bRow = MatchResult::create($base + [
            'user_id' => $b->id, 'won' => false, 'room_code' => 'LKS',
            'log' => json_encode(['hc' => 'black', 'log' => []]),
        ]);

        // Bu .mat beyazı (p0) ŞÜPHELİ 0 veriyor (kısmi .mat), siyahı (p1) gerçek.
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldReceive('matchluck')->andReturn([
            'luck' => [
                'p0' => ['mwc_total' => 0.0, 'emg_total' => 0.0],   // ŞÜPHELİ
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26], // gerçek
            ],
        ]);

        // Beyaz oyuncunun raporundan tetiklenen job (hc=white -> mine=p0 ŞÜPHELİ).
        (new AnalyzeMatchLuckJob($wRow->id, "1 point match\n"))->handle($mock);

        $wRow->refresh();
        $bRow->refresh();
        $this->assertEqualsWithDelta(5.0, (float) $wRow->luck_mwc, 1e-6, 'şüpheli 0, beyazın GERÇEK 5.0 değerini EZMEMELİ');
        $this->assertEqualsWithDelta(-13.0, (float) $bRow->luck_mwc, 1e-6, 'siyahın gerçek değeri boş satıra yazılmalı');
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
