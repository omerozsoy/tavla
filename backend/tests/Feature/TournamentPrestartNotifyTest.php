<?php

namespace Tests\Feature;

use App\Http\Controllers\TournamentController;
use App\Models\Notification;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Turnuva başlamadan ~3 dk önce katılan oyunculara bildirim (zil + push; frontend bunu toast'a
 * çevirir). runScheduledMaintenance (cron tournaments:tick) her dakika çalışır -> 3dk pencere =
 * ~3 tik, ama Cache::add ile oda başına TEK sefer gönderilmeli.
 */
class TournamentPrestartNotifyTest extends TestCase
{
    use RefreshDatabase;

    public function test_notifies_participants_within_3min_window_only_once(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 10, 26, 20, 0, 0));
        $u1 = User::factory()->create();
        $u2 = User::factory()->create();

        Tournament::create([
            'name' => 'Akşam Kupası',
            'type' => 'bracket',
            'status' => 'open',
            'register_until' => now()->addMinutes(2), // pencere içinde (<=3dk, >şimdi)
            'players' => [['id' => $u1->id], ['id' => $u2->id]],
        ]);

        $tc = app(TournamentController::class);
        $tc->runScheduledMaintenance();

        $this->assertSame(1, Notification::where('user_id', $u1->id)->count());
        $this->assertSame(1, Notification::where('user_id', $u2->id)->count());
        $this->assertStringContainsString('Akşam Kupası', Notification::where('user_id', $u1->id)->first()->title);

        // İkinci tik (hâlâ pencerede) tekrar GÖNDERMEMELİ -> Cache::add guard.
        $tc->runScheduledMaintenance();
        $this->assertSame(1, Notification::where('user_id', $u1->id)->count());

        Carbon::setTestNow();
    }

    public function test_does_not_notify_when_start_is_far_or_passed(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 10, 26, 20, 0, 0));
        $far = User::factory()->create();
        $past = User::factory()->create();

        Tournament::create([
            'name' => 'Geç Kupa', 'type' => 'bracket', 'status' => 'open',
            'register_until' => now()->addMinutes(10), // pencere dışı (>3dk)
            'players' => [['id' => $far->id]],
        ]);
        Tournament::create([
            'name' => 'Geçmiş Kupa', 'type' => 'bracket', 'status' => 'open',
            'register_until' => now()->subMinute(), // zaten başlamalıydı (>şimdi değil)
            'players' => [['id' => $past->id]],
        ]);

        app(TournamentController::class)->runScheduledMaintenance();

        $this->assertSame(0, Notification::where('user_id', $far->id)->count());
        $this->assertSame(0, Notification::where('user_id', $past->id)->count());

        Carbon::setTestNow();
    }
}
