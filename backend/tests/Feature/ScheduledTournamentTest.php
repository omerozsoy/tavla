<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\TournamentSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Periyodik turnuva kurucu (tournaments:create-scheduled) çekirdek mantığı: bugüne denk gelen aktif
 * şablondan turnuva kurar, register_until'ı doğru saate koyar, aynı gün ikinci çalıştırmada
 * TEKRAR KURMAZ (idempotent), bugüne denk gelmeyen/pasif şablonlara dokunmaz.
 */
class ScheduledTournamentTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_tournament_for_todays_weekday_and_is_idempotent(): void
    {
        // Bilinen bir güne sabitle: 2026-10-23 = Cuma (ISO 5).
        Carbon::setTestNow(Carbon::create(2026, 10, 23, 0, 0, 0));

        $s = TournamentSchedule::create([
            'name' => 'Cuma Akşamı',
            'active' => true,
            'weekdays' => [5, 1],         // Cuma + Pazartesi
            'start_time' => '20:30',
            'type' => 'bracket',
            'size' => 8,
            'match_length' => 1,
            'prize_coins' => 0,
            'entry_fee' => 50,
            'premium_only' => true,
        ]);

        $this->artisan('tournaments:create-scheduled')->assertSuccessful();

        $t = Tournament::where('name', 'like', 'Cuma Akşamı%')->first();
        $this->assertNotNull($t, 'Cuma günü turnuva kurulmalı');
        $this->assertSame('open', $t->status);
        $this->assertSame(50, $t->entry_fee);
        $this->assertSame('2026-10-23 20:30', $t->register_until->format('Y-m-d H:i'));

        // Aynı gün ikinci çalıştırma -> tekrar kurmamalı (idempotent).
        $this->artisan('tournaments:create-scheduled')->assertSuccessful();
        $this->assertSame(1, Tournament::where('name', 'like', 'Cuma Akşamı%')->count());

        // Pasif şablon + bugüne denk gelmeyen gün -> hiç kurmamalı.
        TournamentSchedule::create(['name' => 'Pasif', 'active' => false, 'weekdays' => [5], 'start_time' => '21:00', 'type' => 'bracket', 'size' => 8, 'match_length' => 1, 'prize_coins' => 0, 'entry_fee' => 0, 'premium_only' => true]);
        TournamentSchedule::create(['name' => 'Salı', 'active' => true, 'weekdays' => [2], 'start_time' => '21:00', 'type' => 'bracket', 'size' => 8, 'match_length' => 1, 'prize_coins' => 0, 'entry_fee' => 0, 'premium_only' => true]);
        $this->artisan('tournaments:create-scheduled')->assertSuccessful();
        $this->assertSame(0, Tournament::where('name', 'like', 'Pasif%')->count());
        $this->assertSame(0, Tournament::where('name', 'like', 'Salı%')->count());

        Carbon::setTestNow();
    }
}
