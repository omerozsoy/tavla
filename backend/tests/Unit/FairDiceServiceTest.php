<?php

namespace Tests\Unit;

use App\Services\FairDiceService;
use PHPUnit\Framework\TestCase;

// F10: sunucu-otoriter provably-fair zarin cekirdek garantileri (determinizm, aralik,
// modulo-bias yoklugu, commit-reveal). Saf PHP -> Laravel boot gerekmez.
class FairDiceServiceTest extends TestCase
{
    private FairDiceService $dice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dice = new FairDiceService();
    }

    public function test_roll_is_deterministic_for_same_inputs(): void
    {
        $seed = 'fixedseed-not-random';
        $this->assertSame(
            $this->dice->roll($seed, 'client', 7),
            $this->dice->roll($seed, 'client', 7),
        );
    }

    public function test_different_index_is_reproducible_per_index(): void
    {
        $seed = 'fixedseed-not-random';
        $first = $this->dice->roll($seed, 'c', 1);
        $this->dice->roll($seed, 'c', 2); // araya baska index
        $this->assertSame($first, $this->dice->roll($seed, 'c', 1)); // index 1 degismez
    }

    public function test_roll_values_always_in_1_to_6(): void
    {
        $seed = 'deadbeefcafe';
        for ($i = 0; $i < 2000; $i++) {
            [$d1, $d2] = $this->dice->roll($seed, 'c', $i);
            $this->assertGreaterThanOrEqual(1, $d1);
            $this->assertLessThanOrEqual(6, $d1);
            $this->assertGreaterThanOrEqual(1, $d2);
            $this->assertLessThanOrEqual(6, $d2);
        }
    }

    public function test_all_six_faces_appear_no_face_excluded(): void
    {
        // byte<252 reddi modulo bias'i engeller -> hicbir yuz sistematik dislanmamali.
        // Sabit seed: deterministik (flaky degil); 600 index = 1200 zar.
        $seed = 'facefeed-coverage';
        $seen = [];
        for ($i = 0; $i < 600; $i++) {
            [$d1, $d2] = $this->dice->roll($seed, 'c', $i);
            $seen[$d1] = true;
            $seen[$d2] = true;
        }
        ksort($seen);
        $this->assertSame([1, 2, 3, 4, 5, 6], array_keys($seen));
    }

    public function test_single_opening_in_range_and_deterministic(): void
    {
        $seed = 'opening-seed';
        $this->assertSame(
            $this->dice->single($seed, 'c', 1),
            $this->dice->single($seed, 'c', 1),
        );
        for ($i = 0; $i < 500; $i++) {
            $v = $this->dice->single($seed, 'c', $i);
            $this->assertGreaterThanOrEqual(1, $v);
            $this->assertLessThanOrEqual(6, $v);
        }
    }

    public function test_commit_matches_seed_and_rejects_tampering(): void
    {
        $seed = $this->dice->newSeed();
        $commit = $this->dice->commit($seed);
        $this->assertSame(64, strlen($commit));          // sha256 hex
        $this->assertTrue($this->dice->verifyCommit($seed, $commit));
        $this->assertFalse($this->dice->verifyCommit($seed.'0', $commit));
        $this->assertFalse($this->dice->verifyCommit('tampered-seed', $commit));
    }

    public function test_new_seed_is_32_bytes_and_unique(): void
    {
        $s1 = $this->dice->newSeed();
        $s2 = $this->dice->newSeed();
        $this->assertSame(64, strlen($s1)); // 32 bayt = 64 hex
        $this->assertNotSame($s1, $s2);
    }
}
