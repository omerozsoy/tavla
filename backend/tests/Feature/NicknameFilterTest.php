<?php

namespace Tests\Feature;

use App\Support\NicknameFilter;
use Tests\TestCase;

/**
 * Takma ad kufur suzgeci: normalize (TR/leet/sembol kacislari) + varsayilan liste engeli.
 * Admin kaydi yoksa NicknameFilter::DEFAULT_LIST devrede (settings tablosu bos/yok -> fallback).
 */
class NicknameFilterTest extends TestCase
{
    public function test_normalize_strips_symbols_leet_and_turkish(): void
    {
        $this->assertSame('amk', NicknameFilter::normalize('A.M.K!'));
        $this->assertSame('amk', NicknameFilter::normalize('4mk'));
        $this->assertSame('siktir', NicknameFilter::normalize('S.İ.K.T.İ.R'));
    }

    public function test_clean_nicknames_allowed(): void
    {
        $this->assertTrue(NicknameFilter::isAllowed('player123'));
        $this->assertTrue(NicknameFilter::isAllowed('V.Constantin'));
        $this->assertTrue(NicknameFilter::isAllowed('Mehmet42'));
    }

    public function test_profanity_blocked_including_evasions(): void
    {
        $this->assertFalse(NicknameFilter::isAllowed('amk'));
        $this->assertFalse(NicknameFilter::isAllowed('amk_pro'));
        $this->assertFalse(NicknameFilter::isAllowed('4mk')); // leetspeak
        $this->assertFalse(NicknameFilter::isAllowed('SikTirGit'));
        $this->assertFalse(NicknameFilter::isAllowed('xXfuckXx'));
    }
}
