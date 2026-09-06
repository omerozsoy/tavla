<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeMatchLuckJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

// Tavlai Luck V1 (KALICI): job İKİ oyuncunun logunu BİRLEŞTİRİP tam .mat kurar (MatBuilder) ->
// gnubg NATIVE luck -> per-oyuncu MWC%. .mat sütun 0=white, 1=black -> her satıra KENDİ rengi.
// gnubg HTTP mock'lu (gerçek gnubg sunucuda; .mat üretimi + eşleme + suspicious mantığı test edilir).
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

    /** İki satır (aynı oda), her biri KENDİ renginde tam log. Döner: [whiteRow, blackRow]. */
    private function rows(string $room = 'LK1'): array
    {
        $w = $this->user('w'.substr(md5($room), 0, 4));
        $b = $this->user('b'.substr(md5($room), 0, 4));
        $base = ['opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0, 'match_length' => 1];
        $wRow = MatchResult::create($base + [
            'user_id' => $w->id, 'won' => true, 'room_code' => $room,
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'notation' => '8/5 6/5', 'dice' => [3, 1], 'seq' => 0],
            ]]),
        ]);
        $bRow = MatchResult::create($base + [
            'user_id' => $b->id, 'won' => false, 'room_code' => $room,
            'log' => json_encode(['hc' => 'black', 'log' => [
                ['player' => 'black', 'notation' => '24/21 13/11', 'dice' => [3, 2], 'seq' => 1],
            ]]),
        ]);

        return [$wRow, $bRow];
    }

    public function test_merged_writes_luck_to_both_colors(): void
    {
        [$wRow, $bRow] = $this->rows('LKM');
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldReceive('matchluck')->once()->andReturn([
            'luck' => [
                'p0' => ['mwc_total' => 39.0, 'emg_total' => 0.78],   // white
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26], // black
            ],
        ]);

        (new AnalyzeMatchLuckJob($wRow->id))->handle($mock);

        $wRow->refresh();
        $bRow->refresh();
        $this->assertEqualsWithDelta(39.0, (float) $wRow->luck_mwc, 1e-6, 'beyaz satırı white (p0) luck');
        $this->assertEqualsWithDelta(0.78, (float) $wRow->luck_emg, 1e-6);
        $this->assertEqualsWithDelta(-13.0, (float) $bRow->luck_mwc, 1e-6, 'siyah satırı black (p1) luck');
        $this->assertSame('TAVLAI_LUCK_V1', $wRow->luck_method);
    }

    public function test_waits_when_opponent_not_reported(): void
    {
        // Rakip satırı yoksa (henüz raporlamadı) -> job hiçbir şey yazmaz (rakip raporunda tetiklenir).
        $w = $this->user('solo1');
        $wRow = MatchResult::create([
            'user_id' => $w->id, 'won' => true, 'room_code' => 'LKW', 'match_length' => 1,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'log' => json_encode(['hc' => 'white', 'log' => [['player' => 'white', 'notation' => '8/5', 'dice' => [3, 1], 'seq' => 0]]]),
        ]);
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldNotReceive('matchluck'); // rakip yok -> gnubg çağrılmamalı

        (new AnalyzeMatchLuckJob($wRow->id))->handle($mock);

        $this->assertNull($wRow->fresh()->luck_mwc);
    }

    public function test_suspicious_zero_not_written(): void
    {
        // Birleştirmeye rağmen bir oyuncu emg=0 (imkânsız) dönerse o satır YAZILMAZ (gerçeği ezmez).
        [$wRow, $bRow] = $this->rows('LKS');
        MatchResult::where('id', $wRow->id)->update(['luck_mwc' => 5.0, 'luck_emg' => 0.1]); // önceki gerçek
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldReceive('matchluck')->andReturn([
            'luck' => [
                'p0' => ['mwc_total' => 0.0, 'emg_total' => 0.0],    // white ŞÜPHELİ
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26], // black gerçek
            ],
        ]);

        (new AnalyzeMatchLuckJob($bRow->id))->handle($mock);

        $this->assertEqualsWithDelta(5.0, (float) $wRow->fresh()->luck_mwc, 1e-6, 'şüpheli 0 gerçek 5.0\'ı ezmemeli');
        $this->assertEqualsWithDelta(-13.0, (float) $bRow->fresh()->luck_mwc, 1e-6);
    }

    public function test_skips_when_both_rows_already_computed(): void
    {
        // Çift gnubg analizi önlemi: iki satır da ZATEN luck_mwc'ye sahipse (diğer oyuncunun job'ı
        // yaptı) job gnubg'yi TEKRAR çağırmamalı.
        [$wRow, $bRow] = $this->rows('LKD');
        MatchResult::where('id', $wRow->id)->update(['luck_mwc' => 5.0]);
        MatchResult::where('id', $bRow->id)->update(['luck_mwc' => -3.0]);
        $mock = Mockery::mock(GnuBgClient::class);
        $mock->shouldNotReceive('matchluck'); // ikisi de dolu -> tekrar analiz YOK

        (new AnalyzeMatchLuckJob($wRow->id))->handle($mock);

        $this->assertEqualsWithDelta(5.0, (float) $wRow->fresh()->luck_mwc, 1e-6);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
