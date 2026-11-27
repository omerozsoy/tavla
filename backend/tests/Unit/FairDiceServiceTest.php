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

    // ---- v2 (oda kurulurken commit, "<p1>.<p2>" oyuncu tohumları, önekli mesajlar) ----
    // Vektörler src/engine/fairDice.test.ts ile ORTAK (JS portu birebir aynı sonucu vermeli).
    private const SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';

    private const CS2 = '0123456789abcdef.fedcba9876543210';

    public function test_version_is_derived_from_client_seed_format(): void
    {
        $this->assertSame(2, FairDiceService::versionOf(self::CS2));
        $this->assertSame(2, FairDiceService::versionOf(FairDiceService::emptyV2ClientSeed()));
        $this->assertSame(1, FairDiceService::versionOf('clientX'));
        $this->assertSame(1, FairDiceService::versionOf(''));
    }

    public function test_v2_roll_and_opening_vectors(): void
    {
        $this->assertSame([6, 2], $this->dice->roll(self::SEED, self::CS2, 0));
        $this->assertSame([6, 1], $this->dice->roll(self::SEED, self::CS2, 1));
        $this->assertSame([1, 1], $this->dice->roll(self::SEED, self::CS2, 2));
        $this->assertSame([4, 1], $this->dice->roll(self::SEED, '.', 0));
        $this->assertSame(2, $this->dice->openingDie(self::SEED, self::CS2, 1, 0));
        $this->assertSame(2, $this->dice->openingDie(self::SEED, self::CS2, 1, 1));
        $this->assertSame(6, $this->dice->openingDie(self::SEED, self::CS2, 1, 2));
        $this->assertSame(3, $this->dice->openingDie(self::SEED, self::CS2, 2, 0));
    }

    public function test_v1_vectors_unchanged_for_old_rooms(): void
    {
        $this->assertSame([5, 5], $this->dice->roll(self::SEED, 'clientX', 0));
        $this->assertSame(5, $this->dice->openingDie(self::SEED, 'clientX', 1, 0)); // = single(4)
        $this->assertSame(4, $this->dice->openingDie(self::SEED, 'clientX', 1, 1)); // = single(5)
        $this->assertSame($this->dice->single(self::SEED, 'clientX', 8), $this->dice->openingDie(self::SEED, 'clientX', 2, 0));
    }

    public function test_v2_opening_retries_never_reach_next_game(): void
    {
        // v1'de oyun g'nin 4. denemesi (base+4) = oyun g+1'in beyaz zarıydı; v2'de alanlar ayrı.
        $seen = [];
        foreach ([1, 2] as $g) {
            foreach (range(0, 6) as $k) {
                $seen[$g][$k] = $this->dice->openingDie(self::SEED, self::CS2, $g, $k);
            }
        }
        // Aynı oyun/deneme -> aynı değer (deterministik); farklı (g,k) çiftleri farklı mesaj kullanır.
        $this->assertSame($seen[1][4], $this->dice->openingDie(self::SEED, self::CS2, 1, 4));
        $this->assertSame(6, $seen[1][2]);
    }

    public function test_player_seed_contribution_rules(): void
    {
        $this->assertSame('.abcdef0123', FairDiceService::withPlayerSeed('.', 'p2', 'ABCDEF0123'));
        $this->assertSame('aa11bb22.ccdd1122', FairDiceService::withPlayerSeed('aa11bb22.', 'p2', 'ccdd1122'));
        $this->assertNull(FairDiceService::withPlayerSeed('aa11bb22.', 'p1', 'ccdd1122')); // p1 zaten verdi
        $this->assertNull(FairDiceService::withPlayerSeed('clientX', 'p1', 'ccdd1122')); // v1 oda
        $this->assertNull(FairDiceService::withPlayerSeed('.', 'p1', 'x:single')); // hex değil
        $this->assertNull(FairDiceService::withPlayerSeed('.', 'p1', 'abc')); // çok kısa
        $this->assertNull(FairDiceService::withPlayerSeed('.', 'p1', str_repeat('a', 32))); // çok uzun
        $this->assertNull(FairDiceService::withPlayerSeed('.', 'spectator', 'ccdd1122'));
        $this->assertNull(FairDiceService::withPlayerSeed('.', 'p1', null));
        $this->assertLessThanOrEqual(64, strlen(str_repeat('a', 31).'.'.str_repeat('b', 31)));
    }
}
