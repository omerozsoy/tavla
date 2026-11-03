<?php

namespace Tests\Feature;

use App\Models\LeagueAward;
use App\Models\LeagueMatch;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Support\League\LeagueRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Lig sezonu yaşam döngüsü (§2/§5/§11/§18) feature testleri.
 */
class LeagueRuntimeTest extends TestCase
{
    use RefreshDatabase;

    private function premium(): User
    {
        return User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear()]);
    }

    private function free(): User
    {
        return User::factory()->create(['plan' => 'free', 'plan_until' => null]);
    }

    /** @return LeagueSeason sezon + $n premium başvuru (hepsi pending) */
    private function seasonWithApplicants(int $n): LeagueSeason
    {
        $s = LeagueRuntime::createSeason();
        LeagueRuntime::openApplications($s, now()->subMinute(), now()->addDay());
        for ($i = 0; $i < $n; $i++) {
            LeagueRuntime::apply($s, $this->premium());
        }

        return $s->refresh();
    }

    private function acceptAll(LeagueSeason $s): void
    {
        $map = [];
        foreach (LeagueParticipant::where('season_id', $s->id)->pluck('user_id') as $uid) {
            $map[$uid] = 'accepted';
        }
        LeagueRuntime::decide($s, $map);
    }

    public function test_free_user_cannot_apply(): void
    {
        $s = LeagueRuntime::createSeason();
        LeagueRuntime::openApplications($s, now()->subMinute(), now()->addDay());

        $this->expectException(\RuntimeException::class);
        LeagueRuntime::apply($s, $this->free());
    }

    public function test_premium_right_preserved_after_membership_lapses(): void
    {
        // §2: başvuru anında premium -> sonra düşse de hak korunur (yeniden kontrol yok).
        $s = $this->seasonWithApplicants(0);
        $u = $this->premium();
        LeagueRuntime::apply($s, $u);
        // Premium bitti:
        $u->update(['plan' => 'free', 'plan_until' => null]);
        // Kayıt premium_at_apply=true korur; başlatma premium'u yeniden sormaz.
        $this->assertTrue((bool) LeagueParticipant::where('season_id', $s->id)->where('user_id', $u->id)->first()->premium_at_apply);
    }

    public function test_only_one_active_season(): void
    {
        $this->seasonWithApplicants(0); // aktif (applications)
        $s2 = LeagueRuntime::createSeason();
        $this->expectException(\RuntimeException::class);
        LeagueRuntime::openApplications($s2, now(), now()->addDay());
    }

    public function test_cannot_start_with_32(): void
    {
        $s = $this->seasonWithApplicants(32);
        $this->acceptAll($s);
        $this->expectException(\RuntimeException::class);
        LeagueRuntime::startLeague($s);
    }

    public function test_can_start_with_33(): void
    {
        $s = $this->seasonWithApplicants(33);
        $this->acceptAll($s);
        $started = LeagueRuntime::startLeague($s);
        $this->assertSame('league', $started->status);
        // Her kabul edilen oyuncuya seed atandı.
        $this->assertSame(33, LeagueParticipant::where('season_id', $s->id)->whereNotNull('seed')->count());
    }

    public function test_cannot_accept_49(): void
    {
        $s = $this->seasonWithApplicants(49);
        $this->expectException(\RuntimeException::class);
        $this->acceptAll($s); // 49 accepted -> engellenir
    }

    public function test_reserve_cannot_be_added_after_start(): void
    {
        $s = $this->seasonWithApplicants(34);
        $this->acceptAll($s);
        LeagueRuntime::startLeague($s);
        // Sezon başladı (league) -> decide artık engellenir (§2 yeni oyuncu/yedek yok).
        $this->expectException(\RuntimeException::class);
        LeagueRuntime::decide($s->refresh(), [LeagueParticipant::where('season_id', $s->id)->first()->user_id => 'reserve']);
    }

    public function test_draw_round_creates_matches_and_blocks_next_until_resolved(): void
    {
        $s = $this->seasonWithApplicants(34);
        $this->acceptAll($s);
        LeagueRuntime::startLeague($s);

        $r1 = LeagueRuntime::drawRound($s->refresh(), now()->addDay(), now()->addDays(2));
        $this->assertSame(1, $r1);
        $this->assertSame(17, LeagueMatch::where('season_id', $s->id)->where('round', 1)->count()); // 34 -> 17 maç

        // §11: tur bitmeden sıradaki çekilemez.
        $can = LeagueRuntime::canDraw($s->refresh());
        $this->assertFalse($can['can']);
        $this->assertSame('round_incomplete', $can['reason']);

        // Tüm 1. tur maçlarını sonuçla (p1 kazansın).
        foreach (LeagueMatch::where('season_id', $s->id)->where('round', 1)->get() as $m) {
            LeagueRuntime::recordResult($m, 'played', (int) $m->p1_user_id);
        }
        $can2 = LeagueRuntime::canDraw($s->refresh());
        $this->assertTrue($can2['can']);
    }

    public function test_full_8_rounds_then_confirm_freezes_standings_and_builds_prelim(): void
    {
        $s = $this->seasonWithApplicants(40);
        $this->acceptAll($s);
        LeagueRuntime::startLeague($s);

        for ($r = 1; $r <= LeagueSeason::LEAGUE_ROUNDS; $r++) {
            LeagueRuntime::drawRound($s->refresh(), now()->addDays($r), now()->addDays($r + 1));
            foreach (LeagueMatch::where('season_id', $s->id)->where('round', $r)->where('result', 'pending')->get() as $m) {
                // Küçük user_id kazansın (deterministik) — bye zaten 'bye' result, atlanır.
                LeagueRuntime::recordResult($m, 'played', min((int) $m->p1_user_id, (int) $m->p2_user_id));
            }
        }

        $s = LeagueRuntime::confirmLeaguePhase($s->refresh());
        $this->assertSame('knockout', $s->status);
        $this->assertIsArray($s->standings_final);
        $this->assertCount(40, $s->standings_final['rows']);
        // Ön eleme (9-24) oluşturuldu: 8 maç.
        $this->assertSame(8, LeagueMatch::where('season_id', $s->id)->where('phase', 'prelim')->count());
    }

    public function test_knockout_runs_to_champion_and_awards_are_idempotent(): void
    {
        $s = $this->seasonWithApplicants(40);
        $this->acceptAll($s);
        LeagueRuntime::startLeague($s);
        for ($r = 1; $r <= LeagueSeason::LEAGUE_ROUNDS; $r++) {
            LeagueRuntime::drawRound($s->refresh(), now()->addDays($r), now()->addDays($r + 1));
            foreach (LeagueMatch::where('season_id', $s->id)->where('round', $r)->where('result', 'pending')->get() as $m) {
                LeagueRuntime::recordResult($m, 'played', min((int) $m->p1_user_id, (int) $m->p2_user_id));
            }
        }
        $s = LeagueRuntime::confirmLeaguePhase($s->refresh());
        $s->update(['prizes' => [
            ['key' => 'champion', 'coins' => 10000, 'badge' => 'league_champ'],
            ['key' => 'runner_up', 'coins' => 5000],
        ]]);

        // Ön eleme (gerçek maçlar) -> p1 kazansın.
        foreach (LeagueMatch::where('season_id', $s->id)->where('phase', 'prelim')->where('result', 'pending')->get() as $m) {
            LeagueRuntime::recordResult($m, 'played', (int) $m->p1_user_id);
        }
        LeagueRuntime::buildKnockout($s->refresh());

        // r16 -> final: her tur bekleyen (iki oyunculu) maçı p1 kazansın; advanceKnockout otomatik.
        $guard = 0;
        while (LeagueMatch::where('season_id', $s->id)->where('phase', 'final')->where('result', 'pending')->exists() && $guard++ < 50) {
            $pend = LeagueMatch::where('season_id', $s->id)->whereIn('phase', ['r16', 'qf', 'sf', 'final'])
                ->where('result', 'pending')->whereNotNull('p1_user_id')->whereNotNull('p2_user_id')->get();
            if ($pend->isEmpty()) {
                break;
            }
            foreach ($pend as $m) {
                LeagueRuntime::recordResult($m, 'played', (int) $m->p1_user_id);
            }
        }

        $s->refresh();
        $this->assertSame('finished', $s->status);
        $this->assertNull($s->active_lock, 'biten sezon aktif kilidini bırakmalı');
        $final = LeagueMatch::where('season_id', $s->id)->where('phase', 'final')->first();
        $this->assertNotNull($final->winner_user_id);

        $champ = (int) $final->winner_user_id;
        $champUser = User::find($champ);
        $this->assertSame(10000, (int) $champUser->coins, 'şampiyon ödülü verilmeli');
        $this->assertContains('league_champ', $champUser->badges ?? []);
        $this->assertSame(1, LeagueAward::where('season_id', $s->id)->where('user_id', $champ)->where('award_key', 'champion')->count());

        // İdempotent: tekrar dağıt -> coin/rozet DEĞİŞMEZ (mükerrer yok).
        LeagueRuntime::distributeAwards($s->refresh());
        $this->assertSame(10000, (int) User::find($champ)->coins, 'ödül ikinci kez eklenmemeli');
    }
}
