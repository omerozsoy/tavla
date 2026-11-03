<?php

namespace Tests\Feature;

use App\Models\LeagueMatch;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Support\League\LeagueRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Randevu (§8), 15 dk hazır-olma + hükmen (§9), çekilme (§10), admin düzeltme (§13) testleri.
 */
class LeagueMatchFlowTest extends TestCase
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

    private function firstRealMatch(LeagueSeason $s): LeagueMatch
    {
        LeagueRuntime::drawRound($s, now()->addDay(), now()->addDays(2));

        return LeagueMatch::where('season_id', $s->id)->where('round', 1)
            ->where('result', 'pending')->whereNotNull('p2_user_id')->first();
    }

    public function test_appointment_needs_both_sides(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s);
        $at = now()->addHours(5);

        LeagueRuntime::proposeAppointment($m, (int) $m->p1_user_id, $at);
        $m->refresh();
        // Tek taraflı teklif kesin DEĞİL -> effectiveStart hâlâ zorunlu saat.
        $this->assertNull($m->appointment['confirmed_at']);
        $this->assertTrue($m->effectiveStartAt()->equalTo($m->mandatory_at));

        // Teklif eden kendi teklifini onaylayamaz.
        try {
            LeagueRuntime::confirmAppointment($m, (int) $m->p1_user_id);
            $this->fail('kendi teklifini onaylamamalı');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('karşı taraf', $e->getMessage());
        }

        // Karşı taraf onaylar -> kesinleşir.
        LeagueRuntime::confirmAppointment($m, (int) $m->p2_user_id);
        $m->refresh();
        $this->assertNotNull($m->appointment['confirmed_at']);
        $this->assertSame($at->toIso8601String(), $m->effectiveStartAt()->toIso8601String());
    }

    public function test_appointment_cannot_exceed_deadline(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s); // deadline = +2 gün
        $this->expectException(\RuntimeException::class);
        LeagueRuntime::proposeAppointment($m, (int) $m->p1_user_id, now()->addDays(5));
    }

    public function test_only_one_ready_forfeits_other_after_15min(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s);
        // Zorunlu saati geçmişe al ki 15 dk dolmuş olsun.
        $m->update(['mandatory_at' => now()->subMinutes(20)]);
        // Yalnız p1 taze hazır.
        LeagueRuntime::markReady($m->refresh(), (int) $m->p1_user_id);

        $out = LeagueRuntime::resolveReadyWindow($m->refresh(), now());
        $this->assertSame('p2_forfeit', $out);
        $m->refresh();
        $this->assertSame('p2_forfeit', $m->result);
        $this->assertSame((int) $m->p1_user_id, (int) $m->winner_user_id);
    }

    public function test_neither_ready_double_noshow_in_league(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s);
        $m->update(['mandatory_at' => now()->subMinutes(20)]);
        $out = LeagueRuntime::resolveReadyWindow($m->refresh(), now());
        $this->assertSame('double_noshow', $out);
        $this->assertSame('double_noshow', $m->refresh()->result);
    }

    public function test_within_window_no_forfeit(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s);
        $m->update(['mandatory_at' => now()->subMinutes(5)]); // 15 dk dolmadı
        $this->assertNull(LeagueRuntime::resolveReadyWindow($m->refresh(), now()));
        $this->assertSame('pending', $m->refresh()->result);
    }

    public function test_stale_ready_is_not_present(): void
    {
        $s = $this->startedSeason();
        $m = $this->firstRealMatch($s);
        $m->update([
            'mandatory_at' => now()->subMinutes(20),
            'ready_p1_at' => now()->subMinutes(10), // bayat (>60sn) -> present değil
            'ready_p2_at' => now()->subSeconds(10), // taze
        ]);
        $out = LeagueRuntime::resolveReadyWindow($m->refresh(), now());
        $this->assertSame('p1_forfeit', $out); // bayat p1 hükmen mağlup, taze p2 kazanır
    }

    public function test_withdraw_forfeits_current_match_and_preserves_points(): void
    {
        $s = $this->startedSeason(34);
        LeagueRuntime::drawRound($s, now()->addDay(), now()->addDays(2));
        // 1. turu bitir (p1 kazansın), 2. turu çek.
        foreach (LeagueMatch::where('season_id', $s->id)->where('round', 1)->where('result', 'pending')->get() as $mm) {
            LeagueRuntime::recordResult($mm, 'played', (int) $mm->p1_user_id);
        }
        LeagueRuntime::drawRound($s->refresh(), now()->addDays(3), now()->addDays(4));
        $m2 = LeagueMatch::where('season_id', $s->id)->where('round', 2)->where('result', 'pending')->whereNotNull('p2_user_id')->first();
        $quitter = (int) $m2->p1_user_id;
        $opp = (int) $m2->p2_user_id;

        LeagueRuntime::withdraw($s->refresh(), $quitter);

        $m2->refresh();
        $this->assertSame('p1_forfeit', $m2->result);        // çekilen hükmen mağlup
        $this->assertSame($opp, (int) $m2->winner_user_id);  // rakip kazandı
        // Çekilen hâlâ katılımcı listesinde withdrawn olarak görünür (puanı korunur).
        $p = LeagueParticipant::where('season_id', $s->id)->where('user_id', $quitter)->first();
        $this->assertSame('withdrawn', $p->status);
        $this->assertGreaterThanOrEqual(1, $p->state['points']); // 1. turdaki galibiyeti korundu
    }

    public function test_admin_correct_result_recomputes_and_audits(): void
    {
        $s = $this->startedSeason(34);
        $m = $this->firstRealMatch($s);
        $p1 = (int) $m->p1_user_id;
        $p2 = (int) $m->p2_user_id;
        LeagueRuntime::recordResult($m, 'played', $p1);
        $this->assertSame(1, LeagueParticipant::where('season_id', $s->id)->where('user_id', $p1)->first()->state['points']);

        // Admin düzeltir: aslında p2 kazanmış.
        $admin = User::factory()->create();
        LeagueRuntime::correctResult($m->refresh(), 'played', $p2, $admin->id, 'yanlış bildirim');

        $this->assertSame(0, LeagueParticipant::where('season_id', $s->id)->where('user_id', $p1)->first()->state['points']);
        $this->assertSame(1, LeagueParticipant::where('season_id', $s->id)->where('user_id', $p2)->first()->state['points']);
        $this->assertSame('yanlış bildirim', $m->refresh()->admin_note);
    }
}
