<?php

namespace Tests\Feature;

use App\Jobs\SendPushJob;
use App\Models\LeagueMatch;
use App\Models\LeagueNotification;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Support\League\LeagueRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * league:tick nöbetçisi (§14 hatırlatma idempotentliği, §9 hükmen) testleri.
 */
class LeagueTickTest extends TestCase
{
    use RefreshDatabase;

    private function startedSeason(int $n = 34): LeagueSeason
    {
        $s = LeagueRuntime::createSeason();
        LeagueRuntime::openApplications($s, now()->subMinute(), now()->addDay());
        for ($i = 0; $i < $n; $i++) {
            LeagueRuntime::apply($s, User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear()]));
        }
        $s->refresh();
        $map = [];
        foreach (LeagueParticipant::where('season_id', $s->id)->pluck('user_id') as $uid) {
            $map[$uid] = 'accepted';
        }
        LeagueRuntime::decide($s, $map);
        LeagueRuntime::startLeague($s);

        return $s->refresh();
    }

    public function test_new_pairing_notification_sent_once_per_channel(): void
    {
        Mail::fake();
        Queue::fake();
        $s = $this->startedSeason();
        LeagueRuntime::drawRound($s, now()->addDays(10), now()->addDays(11)); // uzak -> yalnız new_pairing
        $m = LeagueMatch::where('season_id', $s->id)->where('round', 1)->whereNotNull('p2_user_id')->first();

        $this->artisan('league:tick')->assertExitCode(0);
        $first = LeagueNotification::where('match_id', $m->id)->where('kind', 'new_pairing')->count();
        $this->assertSame(3, $first); // site + push + email, bir kez

        $this->artisan('league:tick')->assertExitCode(0);
        $this->assertSame(3, LeagueNotification::where('match_id', $m->id)->where('kind', 'new_pairing')->count(),
            'ikinci tick mükerrer bildirim yazmamalı (§14)');

        Queue::assertPushed(SendPushJob::class); // push kanalı denendi
    }

    public function test_tick_resolves_forfeit_after_window(): void
    {
        Mail::fake();
        Queue::fake();
        $s = $this->startedSeason();
        LeagueRuntime::drawRound($s, now()->addDays(10), now()->addDays(11));
        $m = LeagueMatch::where('season_id', $s->id)->where('round', 1)->whereNotNull('p2_user_id')->first();
        $m->update(['mandatory_at' => now()->subMinutes(20)]); // 15 dk doldu
        LeagueRuntime::markReady($m->refresh(), (int) $m->p1_user_id); // yalnız p1 hazır

        $this->artisan('league:tick')->assertExitCode(0);
        $m->refresh();
        $this->assertSame('p2_forfeit', $m->result);
        $this->assertSame((int) $m->p1_user_id, (int) $m->winner_user_id);
    }

    public function test_tick_fires_24h_reminder_at_mark(): void
    {
        Mail::fake();
        Queue::fake();
        $s = $this->startedSeason();
        LeagueRuntime::drawRound($s, now()->addDay(), now()->addDays(3)); // zorunlu saat ~24 saat sonra
        $m = LeagueMatch::where('season_id', $s->id)->where('round', 1)->whereNotNull('p2_user_id')->first();

        $this->artisan('league:tick')->assertExitCode(0);
        $this->assertTrue(
            LeagueNotification::where('match_id', $m->id)->where('kind', 'remind_24h')->exists(),
            '24 saat işaretinde hatırlatma gönderilmeli'
        );
    }
}
