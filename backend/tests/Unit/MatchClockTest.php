<?php

namespace Tests\Unit;

use App\Services\MatchClock;
use PHPUnit\Framework\TestCase;

// Saf domain testi (DB'siz): DELAY sistemi banka hesabi + AFK + sahiplik-koruma.
// 'now' enjekte edildigi icin zaman deterministik; gercek beklemeye gerek yok.
class MatchClockTest extends TestCase
{
    private const T0 = 1_000_000.0; // sabit baslangic epoch

    // Minimal oyun state'i uret.
    private function state(string $turn, int $target, int $turnsPlayed = 0, int $played = 0, array $extra = []): array
    {
        return array_merge([
            'turnStart' => ['turn' => $turn],
            'turnsPlayed' => $turnsPlayed,
            'played' => array_fill(0, $played, ['x' => 1]),
            'starter' => 'white',
            'match' => [
                'target' => $target,
                'cube' => ['value' => 1, 'owner' => null],
                'score' => ['white' => 0, 'black' => 0],
            ],
        ], $extra);
    }

    // init + ilk aksiyon: saati t0'da beyaz sirasinda baslat.
    private function started(string $mode, int $target, string $turn = 'white'): array
    {
        $c = MatchClock::init($mode, $target, self::T0);
        return MatchClock::onUpdate($c, $this->state($turn, $target), $turn === 'white' ? 'p1' : 'p2', self::T0);
    }

    // ---- 1) Banka matrisi: maç uzunluğu × tempo (spec tablosu) ----
    public function test_bank_matrix_matches_spec(): void
    {
        // [mode, target, beklenen_banka_sn, beklenen_delay]
        $cases = [
            ['casual', 1, 180, 15], ['normal', 1, 60, 10], ['speed', 1, 24, 8],
            ['casual', 3, 540, 15], ['normal', 3, 180, 10], ['speed', 3, 72, 8],
            ['casual', 5, 900, 15], ['normal', 5, 300, 10], ['speed', 5, 120, 8],
            ['casual', 7, 1260, 15], ['normal', 7, 420, 10], ['speed', 7, 168, 8],
        ];
        foreach ($cases as [$mode, $target, $bank, $delay]) {
            $c = MatchClock::init($mode, $target, self::T0);
            $this->assertEqualsWithDelta($bank, $c['p1_bank'], 0.001, "$mode/$target p1");
            $this->assertEqualsWithDelta($bank, $c['p2_bank'], 0.001, "$mode/$target p2");
            $this->assertSame($delay, $c['delay'], "$mode/$target delay");
        }
    }

    // ---- 2) Delay icinde ana sure AZALMAZ ----
    public function test_main_time_frozen_during_delay(): void
    {
        $c = $this->started('normal', 5); // banka 300, delay 10
        $v = MatchClock::clientView($c, self::T0 + 5); // 5sn < delay
        $this->assertEqualsWithDelta(300, $v['white'], 0.001);
        $this->assertEqualsWithDelta(5, $v['delay'], 0.001);
        $this->assertNull($v['afk']); // 5sn -> AFK geri sayimi henuz yok
        $this->assertSame('white', $v['active']);
    }

    // ---- 3) Delay bitince ana sure azalir; SADECE aktif oyuncu ----
    public function test_main_time_decrements_after_delay_only_active(): void
    {
        $c = $this->started('normal', 5); // banka 300, delay 10
        $v = MatchClock::clientView($c, self::T0 + 15); // 15sn: delay 10 + 5sn ana
        $this->assertEqualsWithDelta(295, $v['white'], 0.001);
        $this->assertEqualsWithDelta(300, $v['black'], 0.001); // rakip saati DURUYOR
        $this->assertEqualsWithDelta(0, $v['delay'], 0.001);
    }

    // ---- 4) TIMEOUT: kisa ana sure (speed 1 puan) ----
    public function test_timeout_when_bank_exhausted(): void
    {
        $c = $this->started('speed', 1); // banka 24, delay 8 -> timeout t0+32
        $this->assertEmpty(MatchClock::tick($c, self::T0 + 33)['end'] ?? null); // 33 < 32+grace(3)
        $end = MatchClock::tick($c, self::T0 + 35)['end']; // 35 >= 32+3
        $this->assertSame('TIMEOUT', $end['reason']);
        $this->assertSame('p2', $end['winner']); // beyaz(p1) suresi bitti -> siyah(p2) kazandi
    }

    // ---- 5) AFK: uzun ana sure (casual 5) -> 45sn'de AFK_TIMEOUT ----
    public function test_afk_timeout_when_idle(): void
    {
        $c = $this->started('casual', 5); // banka 900 -> timeout cok ileride; afk t0+45
        $this->assertEmpty(MatchClock::tick($c, self::T0 + 47)['end'] ?? null); // 47 < 45+3
        $end = MatchClock::tick($c, self::T0 + 48)['end']; // 48 >= 45+3
        $this->assertSame('AFK_TIMEOUT', $end['reason']);
        $this->assertSame('p2', $end['winner']);
    }

    // ---- 6) AFK geri sayimi yalniz son 15 saniyede gorunur ----
    public function test_afk_countdown_visible_only_last_15s(): void
    {
        $c = $this->started('casual', 5);
        $this->assertNull(MatchClock::clientView($c, self::T0 + 29)['afk']); // 16sn kaldi
        $this->assertSame(15, MatchClock::clientView($c, self::T0 + 30)['afk']);
        $this->assertSame(10, MatchClock::clientView($c, self::T0 + 35)['afk']);
        $this->assertSame(1, MatchClock::clientView($c, self::T0 + 44)['afk']);
    }

    // ---- 7) Gercek hamle delay+AFK'yi TAM sifirlar; ana sure islenir ----
    public function test_real_action_resets_delay_and_afk(): void
    {
        $c = $this->started('normal', 5); // banka 300, delay 10
        // 20sn sonra ayni oyuncu gercek hamle yapar (played+1) -> segment islenir
        $c2 = MatchClock::onUpdate($c, $this->state('white', 5, 0, 1), 'p1', self::T0 + 20);
        // Gecen segment: 20sn - delay10 = 10sn ana kullanildi -> 290
        $this->assertEqualsWithDelta(290, $c2['p1_bank'], 0.001);
        // Yeni segment: delay ve AFK sifir
        $v = MatchClock::clientView($c2, self::T0 + 20);
        $this->assertEqualsWithDelta(10, $v['delay'], 0.001);
        $this->assertNull($v['afk']);
    }

    // ---- 8) Refresh/reconnect (ayni state tekrar) AFK'yi SIFIRLAMAZ ----
    public function test_refresh_does_not_reset_afk(): void
    {
        $c = $this->started('casual', 5); // afk t0+45
        $same = $this->state('white', 5); // ayni imza (echo / reconnect re-send)
        // 35sn sonra ayni state tekrar gonderilir -> started_at DOKUNULMAZ
        $c2 = MatchClock::onUpdate($c, $same, 'p1', self::T0 + 35);
        $this->assertSame($c['started_at'], $c2['started_at']);
        $this->assertSame(10, MatchClock::clientView($c2, self::T0 + 35)['afk']); // hala sayiyor
        // Poll (tick) de sifirlamaz -> 48sn'de AFK kaybi
        $this->assertSame('AFK_TIMEOUT', MatchClock::tick($c2, self::T0 + 48)['end']['reason']);
    }

    // ---- 9) Sahiplik-koruma: rakip forge ile AFK'yi yonlendiremez ----
    public function test_non_owner_cannot_reset_or_redirect_clock(): void
    {
        $c = $this->started('casual', 5); // aktif p1 (beyaz), afk t0+45
        // p2 (sira sahibi DEGIL) imza degistiren forge state gonderir
        $forge = $this->state('white', 5, 1, 2); // farkli imza
        $c2 = MatchClock::onUpdate($c, $forge, 'p2', self::T0 + 20);
        // started_at DEGISMEZ, aktif hala p1 -> forge AFK'yi sifirlayamadi
        $this->assertSame($c['started_at'], $c2['started_at']);
        $this->assertSame('p1', $c2['turn_slot']);
        $this->assertSame('AFK_TIMEOUT', MatchClock::tick($c2, self::T0 + 48)['end']['reason']);
    }

    // ---- 9b) Mesru devir: sira sahibi turu devredince AFK rakibe gecer ----
    public function test_owner_handoff_switches_active_and_resets(): void
    {
        $c = $this->started('casual', 5); // aktif p1
        // p1 turu bitirir: state artik siyah sirasi
        $c2 = MatchClock::onUpdate($c, $this->state('black', 5, 1, 0), 'p1', self::T0 + 5);
        $this->assertSame('p2', $c2['turn_slot']);
        $v = MatchClock::clientView($c2, self::T0 + 5);
        $this->assertSame('black', $v['active']);
        $this->assertNull($v['afk']); // yeni segment
    }

    // ---- 10) Oyun bitince (gameEnd) saat durur, kayip tetiklenmez ----
    public function test_no_loss_when_game_ended(): void
    {
        $c = MatchClock::init('speed', 1, self::T0);
        $ended = $this->state('white', 1, 0, 0, ['gameEnd' => ['winner' => 'white']]);
        $c = MatchClock::onUpdate($c, $ended, 'p1', self::T0);
        $this->assertFalse($c['running']);
        $this->assertEmpty(MatchClock::tick($c, self::T0 + 100)['end'] ?? null);
    }

    // ---- 11) clientView kayip -> renge cevrilir ----
    public function test_client_view_maps_loss_to_color(): void
    {
        $c = $this->started('speed', 1); // aktif beyaz(p1)
        $v = MatchClock::clientView(MatchClock::tick($c, self::T0 + 40), self::T0 + 40);
        $this->assertNotNull($v['loss']);
        $this->assertSame('black', $v['loss']['winner']); // p2 -> siyah
        $this->assertSame('TIMEOUT', $v['loss']['reason']);
    }

    // ---- 12) TIMEOUT, AFK'dan ONCE gerceklesirse TIMEOUT kazanir (hangisi once) ----
    public function test_earliest_condition_wins(): void
    {
        // speed 1: timeout t0+32 < afk t0+45 -> TIMEOUT
        $c = $this->started('speed', 1);
        $this->assertSame('TIMEOUT', MatchClock::tick($c, self::T0 + 60)['end']['reason']);
    }
}
