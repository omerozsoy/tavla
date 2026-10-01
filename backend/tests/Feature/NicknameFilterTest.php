<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Support\NicknameFilter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Takma ad kufur suzgeci: normalize (TR/leet/sembol kacislari) + varsayilan liste engeli.
 * Admin kaydi yoksa NicknameFilter::DEFAULT_LIST devrede (settings tablosu bos/yok -> fallback).
 */
class NicknameFilterTest extends TestCase
{
    use RefreshDatabase;
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

    // 2-harf kokler (mk/aq/oc) artik elenir: masum kelimeler bloke olmamali (scunthorpe).
    public function test_short_root_false_positives_allowed(): void
    {
        // panelde admin'in ekledigi tip 2-harf kokler dahil (put -> cache forget)
        Setting::put('banned_nicknames', "amk\nmk\naq\noc\nsiktir");

        $this->assertTrue(NicknameFilter::isAllowed('mümkün'));   // mk
        $this->assertTrue(NicknameFilter::isAllowed('çocuk'));    // oc
        $this->assertTrue(NicknameFilter::isAllowed('ocak'));     // oc
        $this->assertTrue(NicknameFilter::isAllowed('koç'));      // oc

        $this->assertFalse(NicknameFilter::isAllowed('amk'));     // 3-harf kok korunur
        $this->assertFalse(NicknameFilter::isAllowed('siktir'));
    }

    // '=' onekli kokler TAM-KELIME: tek basina engellenir ama icinde gectigi kelimeler serbest.
    public function test_whole_word_roots_match_exact_token_only(): void
    {
        Setting::put('banned_nicknames', "amk\n=got\n=pic");

        $this->assertFalse(NicknameFilter::isAllowed('göt'));   // tam kelime -> bloke
        $this->assertFalse(NicknameFilter::isAllowed('piç'));   // tam kelime -> bloke
        $this->assertTrue(NicknameFilter::isAllowed('kapıcı')); // pic substring ama tam kelime degil
        $this->assertTrue(NicknameFilter::isAllowed('ergot'));  // got substring ama tam kelime degil
        $this->assertFalse(NicknameFilter::isAllowed('amk'));   // substring kok hala calisir

        // sohbet: token bazli tam-kelime
        [, $hit1] = \App\Support\ChatModeration::filter('bu piç kim');
        $this->assertTrue($hit1);
        [, $hit2] = \App\Support\ChatModeration::filter('kapıcı geldi');
        $this->assertFalse($hit2);
    }
}
