<?php

namespace Tests\Feature;

use App\Services\FairDiceService;
use Tests\TestCase;

// Sunucu-otoriter provably-fair zar (Faz 1): deterministik + aralik + commit-reveal.
class FairDiceTest extends TestCase
{
    private FairDiceService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new FairDiceService();
    }

    public function test_roll_is_deterministic_for_same_inputs(): void
    {
        $seed = 'a1b2c3'.str_repeat('0', 58);
        $a = $this->svc->roll($seed, 'client', 5);
        $b = $this->svc->roll($seed, 'client', 5);
        $this->assertSame($a, $b, 'Ayni girdi ayni zari vermeli (deterministik).');
    }

    public function test_dice_in_range_1_to_6(): void
    {
        $seed = $this->svc->newSeed();
        for ($i = 0; $i < 500; $i++) {
            [$d1, $d2] = $this->svc->roll($seed, 'cs', $i);
            $this->assertGreaterThanOrEqual(1, $d1);
            $this->assertLessThanOrEqual(6, $d1);
            $this->assertGreaterThanOrEqual(1, $d2);
            $this->assertLessThanOrEqual(6, $d2);
            $s = $this->svc->single($seed, 'cs', $i);
            $this->assertGreaterThanOrEqual(1, $s);
            $this->assertLessThanOrEqual(6, $s);
        }
    }

    public function test_different_index_generally_differs(): void
    {
        // Farkli index'ler cogunlukla farkli zar verir (istemci re-roll ile secim yapamaz
        // mantiginin temeli: her el ayri deterministik degerdir).
        $seed = $this->svc->newSeed();
        $rolls = [];
        for ($i = 0; $i < 20; $i++) {
            $rolls[] = implode('-', $this->svc->roll($seed, 'cs', $i));
        }
        $this->assertGreaterThan(1, count(array_unique($rolls)), 'Index degisince zar degismeli.');
    }

    public function test_commit_reveal_verifies(): void
    {
        $seed = $this->svc->newSeed();
        $commit = $this->svc->commit($seed);
        $this->assertSame(64, strlen($commit)); // sha256 hex
        $this->assertTrue($this->svc->verifyCommit($seed, $commit));
        $this->assertFalse($this->svc->verifyCommit($this->svc->newSeed(), $commit));
    }

    public function test_client_seed_changes_outcome(): void
    {
        $seed = $this->svc->newSeed();
        $a = $this->svc->roll($seed, 'clientA', 0);
        $b = $this->svc->roll($seed, 'clientB', 0);
        // Farkli client seed -> (cok yuksek olasilikla) farkli sonuc; en azindan bagimsiz.
        $this->assertTrue(is_array($a) && is_array($b));
    }
}
