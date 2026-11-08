<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Team;
use App\Models\TeamApplication;
use App\Models\TeamInvite;
use App\Models\TeamMatch;
use App\Models\TeamMember;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamService;
use App\Support\TeamLeague\TeamStandings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Takımlar Ligi Faz 1 — korektlik-kritik değişmezler (§13): atomik tek-kesinti kuruluş, uygunluk
 * kapıları, kapasite/başvuru/yardımcı sınırları, 72s bekleme, Premium süresi, devir, kapatma,
 * ana/aylık sıralama eşitlikleri, idempotent ödüller. Süre testleri kontrol edilebilir saatle.
 */
class TeamLeagueTest extends TestCase
{
    use RefreshDatabase;

    private function svc(): TeamService
    {
        return app(TeamService::class);
    }

    private function eligibleUser(array $attrs = []): User
    {
        $u = User::factory()->create(array_merge([
            'plan' => 'premium',
            'plan_until' => now()->addYear(),
            'coins' => 100_000,
            'rating' => 1500,
        ], $attrs));
        for ($i = 0; $i < TeamRules::MIN_RATED_MATCHES; $i++) {
            MatchResult::create([
                'user_id' => $u->id, 'won' => true, 'rated' => true,
                'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            ]);
        }

        return $u->fresh();
    }

    private function makeTeam(?User $founder = null, string $name = 'Kartallar', string $tag = 'KRT'): Team
    {
        $founder = $founder ?: $this->eligibleUser();
        $team = $this->svc()->createTeam($founder, ['name' => $name, 'tag' => $tag]);
        $team->update(['status' => 'active']); // yönetim onayı simülasyonu (pending→active)

        return $team;
    }

    // ---- §2 Kuruluş & ücret -------------------------------------------------

    public function test_create_team_charges_fee_exactly_once(): void
    {
        $founder = $this->eligibleUser(['coins' => 100_000]);
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);

        $this->assertSame('pending', $team->status); // kuruluş YÖNETİM ONAYINA kadar pending
        $this->assertSame(100_000 - TeamRules::FOUND_COST, (int) $founder->fresh()->coins);
        $this->assertSame(1, WalletTransaction::where('user_id', $founder->id)->where('type', 'team_create')->count());
        $this->assertSame('founder', TeamMember::where('user_id', $founder->id)->value('role'));
        $this->assertSame(1, (int) $team->member_count);
    }

    public function test_pending_team_approve_and_reject(): void
    {
        // Onay: pending → active.
        $founder = $this->eligibleUser(['coins' => 100_000]);
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);
        $this->assertSame('pending', $team->status);
        $this->svc()->approveTeam($team, 1);
        $this->assertSame('active', $team->fresh()->status);

        // Ret: ücret İADE + takım + üyelik silinir.
        $founder2 = $this->eligibleUser(['coins' => 100_000]);
        $team2 = $this->svc()->createTeam($founder2, ['name' => 'Baskalari', 'tag' => 'BSK']);
        $this->assertSame(100_000 - TeamRules::FOUND_COST, (int) $founder2->fresh()->coins);
        $this->svc()->rejectTeam($team2);
        $this->assertSame(100_000, (int) $founder2->fresh()->coins);
        $this->assertNull(Team::find($team2->id));
        $this->assertSame(0, TeamMember::where('user_id', $founder2->id)->count());
    }

    public function test_double_create_does_not_double_charge(): void
    {
        $founder = $this->eligibleUser(['coins' => 100_000]);
        $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);

        $this->expectException(TeamException::class);
        try {
            $this->svc()->createTeam($founder->fresh(), ['name' => 'Baskalari', 'tag' => 'BSK']);
        } finally {
            // İkinci istek "already_in_team" ile düşer → tek kesinti, tek takım.
            $this->assertSame(100_000 - TeamRules::FOUND_COST, (int) $founder->fresh()->coins);
            $this->assertSame(1, Team::count());
        }
    }

    public function test_create_requires_premium_rated_and_coins(): void
    {
        $noPrem = $this->eligibleUser(['plan' => 'free', 'plan_until' => null]);
        $this->assertThrowsCode('premium_required', fn () => $this->svc()->createTeam($noPrem, ['name' => 'A Takimi', 'tag' => 'AT']));

        $fewRated = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'coins' => 100_000, 'rating' => 1500]);
        $this->assertThrowsCode('not_enough_rated_matches', fn () => $this->svc()->createTeam($fewRated, ['name' => 'B Takimi', 'tag' => 'BT']));

        $broke = $this->eligibleUser(['coins' => TeamRules::FOUND_COST - 1]);
        $this->assertThrowsCode('insufficient_coins', fn () => $this->svc()->createTeam($broke, ['name' => 'C Takimi', 'tag' => 'CT']));
    }

    // Davetle katılım: 20 puanlı maç şartı YALNIZ kuruluşta; kaptanın davet ettiği premium oyuncu
    // 0 puanlı maçla da kabul edebilir (Premium yine gerekir). (kullanıcı kararı: "sadece Premium kalsın")
    public function test_invited_premium_without_rated_matches_can_accept(): void
    {
        $founder = $this->eligibleUser();
        $team = $this->makeTeam($founder);

        $invitee = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'rating' => 1500]);
        $inv = $this->svc()->invite($founder, $team, $invitee->id);
        $this->svc()->acceptInvite($invitee->fresh(), $inv);
        $this->assertSame('member', TeamMember::where('user_id', $invitee->id)->value('role'));

        // Premium OLMAYAN davetli yine reddedilir.
        $freeInvitee = User::factory()->create(['plan' => 'free', 'plan_until' => null, 'rating' => 1500]);
        $inv2 = $this->svc()->invite($founder, $team, $freeInvitee->id);
        $this->assertThrowsCode('premium_required', fn () => $this->svc()->acceptInvite($freeInvitee->fresh(), $inv2));
    }

    public function test_name_and_tag_uniqueness_is_normalized(): void
    {
        $this->makeTeam(name: 'Kartallar', tag: 'KRT');

        // Büyük/küçük harf + baş/son boşluk duyarsız benzersizlik.
        $this->assertThrowsCode('name_taken', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => '  KARTALLAR ', 'tag' => 'XYZ']));
        $this->assertThrowsCode('tag_taken', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => 'Baska Ad', 'tag' => 'krt']));
    }

    public function test_tag_and_name_format_validation(): void
    {
        $this->assertThrowsCode('tag_format', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => 'Gecerli Ad', 'tag' => 'A']));
        $this->assertThrowsCode('tag_format', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => 'Gecerli Ad', 'tag' => 'ABCDEF']));
        $this->assertThrowsCode('tag_format', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => 'Gecerli Ad', 'tag' => 'A!']));
        $this->assertThrowsCode('name_length', fn () => $this->svc()->createTeam($this->eligibleUser(), ['name' => 'ab', 'tag' => 'OKK']));
    }

    public function test_rename_cooldown_and_fee_and_noop(): void
    {
        $founder = $this->eligibleUser(['coins' => 100_000]);
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);
        $afterCreate = (int) $founder->fresh()->coins;

        // Gerçek değişiklik yok → ücretsiz.
        $this->svc()->rename($team->fresh(), $founder->fresh(), 'Kartallar', 'KRT');
        $this->assertSame($afterCreate, (int) $founder->fresh()->coins);

        // Gerçek değişiklik → 10.000 coin.
        $this->svc()->rename($team->fresh(), $founder->fresh(), 'Sahinler', null);
        $this->assertSame($afterCreate - TeamRules::RENAME_COST, (int) $founder->fresh()->coins);
        $this->assertSame('Sahinler', $team->fresh()->name);

        // 30 gün bekleme → ikinci değişiklik reddedilir, ücret alınmaz.
        $this->assertThrowsCode('rename_cooldown', fn () => $this->svc()->rename($team->fresh(), $founder->fresh(), 'Baykuslar', null));
        $this->assertSame($afterCreate - TeamRules::RENAME_COST, (int) $founder->fresh()->coins);
    }

    // ---- §3 Roller & §4 Üyelik ---------------------------------------------

    public function test_application_limit_three_open(): void
    {
        $user = $this->eligibleUser();
        for ($i = 1; $i <= 3; $i++) {
            $t = $this->makeTeam(name: "Takim $i", tag: "T$i");
            $this->svc()->apply($user->fresh(), $t);
        }
        $t4 = $this->makeTeam(name: 'Takim 4', tag: 'T4');
        $this->assertThrowsCode('too_many_applications', fn () => $this->svc()->apply($user->fresh(), $t4));
    }

    public function test_capacity_guard_on_accept(): void
    {
        $team = $this->makeTeam();
        // Doldur: kurucu + (CAPACITY-1) üye = CAPACITY (kapasite).
        for ($i = 0; $i < TeamRules::CAPACITY - 1; $i++) {
            $u = User::factory()->create(['rating' => 1500]);
            TeamMember::create(['team_id' => $team->id, 'user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
        }
        $this->svc()->recompute($team);
        $this->assertSame(TeamRules::CAPACITY, (int) $team->fresh()->member_count);

        $applicant = $this->eligibleUser();
        $app = TeamApplication::create(['team_id' => $team->id, 'user_id' => $applicant->id, 'status' => 'pending']);
        $founder = User::find($team->founder_id);
        $this->assertThrowsCode('team_full', fn () => $this->svc()->decideApplication($founder, $app, true));
    }

    public function test_accept_closes_other_applications(): void
    {
        $applicant = $this->eligibleUser();
        $teamA = $this->makeTeam(name: 'A Takimi', tag: 'AA');
        $teamB = $this->makeTeam(name: 'B Takimi', tag: 'BB');
        $appA = $this->svc()->apply($applicant->fresh(), $teamA);
        $this->svc()->apply($applicant->fresh(), $teamB);

        $this->svc()->decideApplication(User::find($teamA->founder_id), $appA, true);

        $this->assertSame('accepted', $appA->fresh()->status);
        $this->assertSame('cancelled', TeamApplication::where('team_id', $teamB->id)->where('user_id', $applicant->id)->value('status'));
        $this->assertSame('member', TeamMember::where('user_id', $applicant->id)->value('role'));
    }

    public function test_max_two_assistants(): void
    {
        $team = $this->makeTeam();
        $founder = User::find($team->founder_id);
        $members = [];
        for ($i = 0; $i < 3; $i++) {
            $u = User::factory()->create(['rating' => 1500, 'plan' => 'premium', 'plan_until' => now()->addYear()]);
            TeamMember::create(['team_id' => $team->id, 'user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
            $members[] = $u;
        }
        $this->svc()->recompute($team);

        $this->svc()->promoteAssistant($founder, $team->fresh(), $members[0]->id);
        $this->svc()->promoteAssistant($founder, $team->fresh(), $members[1]->id);
        $this->assertThrowsCode('too_many_assistants', fn () => $this->svc()->promoteAssistant($founder, $team->fresh(), $members[2]->id));
    }

    public function test_assistant_cannot_kick_manager_founder_cannot_be_kicked(): void
    {
        $team = $this->makeTeam();
        $founder = User::find($team->founder_id);
        $asst = User::factory()->create(['rating' => 1500, 'plan' => 'premium', 'plan_until' => now()->addYear()]);
        $member = User::factory()->create(['rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $asst->id, 'role' => 'member', 'joined_at' => now()]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->recompute($team);
        $this->svc()->promoteAssistant($founder, $team->fresh(), $asst->id);

        // Yardımcı normal üyeyi çıkarabilir.
        $this->svc()->kick($asst, $team->fresh(), $member->id);
        $this->assertNull(TeamMember::where('user_id', $member->id)->first());

        // Yardımcı kurucuyu çıkaramaz.
        $this->assertThrowsCode('cannot_kick_founder', fn () => $this->svc()->kick($asst, $team->fresh(), $founder->id));
    }

    // ---- §4 Üyelik: katılım bekleme süresi KALDIRILDI --------------------------

    public function test_leave_has_no_cooldown_allows_immediate_rejoin(): void
    {
        $team = $this->makeTeam();
        $member = $this->eligibleUser();
        TeamMember::create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->recompute($team);

        $this->svc()->leave($member->fresh());
        $this->assertNull(TeamMember::where('user_id', $member->id)->first());

        // Bekleme süresi KALDIRILDI -> cooldown yok, apply 'on_cooldown' atmaz.
        $this->assertNull($this->svc()->cooldownUntil($member->id));
        $other = $this->makeTeam(name: 'Baska', tag: 'BSK');
        $this->svc()->apply($member->fresh(), $other); // istisna ATMAMALI (eskiden on_cooldown)

        // Founder ayrılamaz (devir/kapatma şart).
        $founder = User::find($team->founder_id);
        $this->assertThrowsCode('founder_must_transfer_or_close', fn () => $this->svc()->leave($founder));
    }

    // ---- §5 Premium devamlılığı --------------------------------------------

    public function test_premium_grace_then_removal_with_controlled_clock(): void
    {
        $team = $this->makeTeam();
        $member = User::factory()->create(['plan' => 'free', 'plan_until' => null, 'rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->recompute($team);

        $t0 = Carbon::parse('2026-11-05 10:00:00');
        // 1. süpürme: grace başlar, üye kalır.
        $this->assertSame(0, $this->svc()->premiumGraceSweep($t0));
        $this->assertNotNull(TeamMember::where('user_id', $member->id)->value('premium_grace_until'));

        // 7 gün içinde yenilerse çıkarılmaz (grace temizlenir).
        $member->forceFill(['plan' => 'premium', 'plan_until' => now()->addYear()])->save();
        $this->assertSame(0, $this->svc()->premiumGraceSweep($t0->copy()->addDays(3)));
        $this->assertNull(TeamMember::where('user_id', $member->id)->value('premium_grace_until'));

        // Tekrar düşsün → grace yeniden → süre geçince çıkar + 72s bekleme.
        $member->forceFill(['plan' => 'free', 'plan_until' => null])->save();
        $this->svc()->premiumGraceSweep($t0->copy()->addDays(10)); // grace set
        $this->assertSame(1, $this->svc()->premiumGraceSweep($t0->copy()->addDays(18)));
        $this->assertNull(TeamMember::where('user_id', $member->id)->first());
        $this->assertNotNull($this->svc()->cooldownUntil($member->id));
    }

    public function test_founder_premium_lapse_does_not_remove_founder(): void
    {
        $founder = $this->eligibleUser();
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);
        $founder->forceFill(['plan' => 'free', 'plan_until' => null])->save();

        $this->svc()->premiumGraceSweep(now()->addDays(30));
        $this->assertSame('founder', TeamMember::where('user_id', $founder->id)->value('role'));
    }

    public function test_founder_inactivity_auto_transfer(): void
    {
        $founder = $this->eligibleUser(['last_login_at' => now()->subDays(61)]);
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);
        $team->update(['status' => 'active']); // yönetim onayı simülasyonu (sweep aktif takımları işler)
        $asst = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $asst->id, 'role' => 'assistant', 'appointed_seq' => 1, 'joined_at' => now()]);
        $this->svc()->recompute($team);

        $this->assertSame(1, $this->svc()->founderInactivitySweep(now()));
        $this->assertSame($asst->id, (int) $team->fresh()->founder_id);
        $this->assertSame('founder', TeamMember::where('user_id', $asst->id)->value('role'));
        $this->assertSame('member', TeamMember::where('user_id', $founder->id)->value('role'));
    }

    public function test_manual_transfer_requires_premium_new_founder(): void
    {
        $founder = $this->eligibleUser();
        $team = $this->svc()->createTeam($founder, ['name' => 'Kartallar', 'tag' => 'KRT']);
        $free = User::factory()->create(['plan' => 'free', 'plan_until' => null, 'rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $free->id, 'role' => 'member', 'joined_at' => now()]);

        $this->assertThrowsCode('new_founder_not_premium', fn () => $this->svc()->transferFounder($founder, $team->fresh(), $free->id));

        $prem = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $prem->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->transferFounder($founder, $team->fresh(), $prem->id);
        $this->assertSame($prem->id, (int) $team->fresh()->founder_id);
    }

    // ---- §12 Kapatma --------------------------------------------------------

    public function test_close_team_requires_confirmation_and_blocks_with_members(): void
    {
        $team = $this->makeTeam();
        $founder = User::find($team->founder_id);
        $member = User::factory()->create(['rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->recompute($team);

        $this->assertThrowsCode('confirmation_required', fn () => $this->svc()->closeTeam($founder, $team->fresh(), false));
        // Kurucudan başka üye varken kurucu takımı kapatamaz.
        $this->assertThrowsCode('has_other_members', fn () => $this->svc()->closeTeam($founder, $team->fresh(), true));

        // Üye çıkınca kurucu tek başına kapatabilir.
        TeamMember::where('team_id', $team->id)->where('user_id', $member->id)->delete();
        $this->svc()->recompute($team->fresh());
        $this->svc()->closeTeam($founder, $team->fresh(), true);
        $this->assertSame('closed', $team->fresh()->status);
        $this->assertSame(0, TeamMember::where('team_id', $team->id)->count());
        $this->assertNotNull($this->svc()->cooldownUntil($founder->id));
    }

    public function test_admin_close_cools_down_all_members(): void
    {
        $team = $this->makeTeam();
        $founder = User::find($team->founder_id);
        $member = User::factory()->create(['rating' => 1500]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member', 'joined_at' => now()]);
        $this->svc()->recompute($team);

        // Admin, üyeli takımı da kapatabilir (kurucu engeli admin'i bağlamaz) → herkese cooldown.
        $this->svc()->adminClose($team->fresh(), 1);
        $this->assertSame('closed', $team->fresh()->status);
        $this->assertSame(0, TeamMember::where('team_id', $team->id)->count());
        $this->assertNotNull($this->svc()->cooldownUntil($member->id));
        $this->assertNotNull($this->svc()->cooldownUntil($founder->id));
    }

    public function test_close_blocked_with_active_match(): void
    {
        $team = $this->makeTeam();
        $founder = User::find($team->founder_id);
        TeamMatch::create(['home_team_id' => $team->id, 'away_team_id' => 999, 'status' => 'scheduled']);
        $this->assertThrowsCode('active_matches_pending', fn () => $this->svc()->closeTeam($founder, $team->fresh(), true));
    }

    // ---- §6 Ana sıralama ----------------------------------------------------

    private function teamWith(string $name, string $tag, array $ratings): Team
    {
        $founder = User::factory()->create(['rating' => $ratings[0], 'plan' => 'premium', 'plan_until' => now()->addYear()]);
        $team = Team::create([
            'name' => $name, 'name_key' => TeamService::keyify($name),
            'tag' => $tag, 'tag_key' => TeamService::keyify($tag),
            'founder_id' => $founder->id, 'status' => 'active',
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $founder->id, 'role' => 'founder', 'joined_at' => now()]);
        foreach (array_slice($ratings, 1) as $r) {
            $u = User::factory()->create(['rating' => $r]);
            TeamMember::create(['team_id' => $team->id, 'user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
        }
        $this->svc()->recompute($team);

        return $team->fresh();
    }

    public function test_main_ranking_average_tiebreak_and_min_members(): void
    {
        $high = $this->teamWith('Yuksek', 'YKS', array_fill(0, 8, 1600));
        $low = $this->teamWith('Dusuk', 'DSK', array_fill(0, 8, 1500));
        // Eşit ortalama, daha çok üye → üstte (2. ölçüt).
        $big = $this->teamWith('Buyuk', 'BYK', array_fill(0, 10, 1550));
        $small = $this->teamWith('Kucuk', 'KCK', array_fill(0, 8, 1550));
        // eşik altı üye → sıralamada yok.
        $this->teamWith('Eksik', 'EKS', array_fill(0, TeamRules::MIN_RANK_MEMBERS - 1, 2000));

        $table = app(TeamStandings::class)->mainTable();
        $ids = array_map(fn ($r) => $r['team']->id, $table);

        $this->assertCount(4, $table, 'yalnız eşik üstü üyeli takımlar');
        $this->assertSame($high->id, $ids[0], 'en yüksek ortalama birinci');
        // 1550 ortalamalı iki takım arasında üye sayısı fazla olan önce.
        $posBig = array_search($big->id, $ids, true);
        $posSmall = array_search($small->id, $ids, true);
        $this->assertLessThan($posSmall, $posBig, 'eşit ortalamada çok üyeli üstte');
    }

    // ---- §10 Aylık sıralama & ödüller --------------------------------------

    public function test_monthly_points_double_forfeit_and_idempotent_awards(): void
    {
        $a = $this->teamWith('A', 'AAA', [1500]);
        $b = $this->teamWith('B', 'BBB', [1500]);
        $c = $this->teamWith('C', 'CCC', [1500]);
        $mk = '2026-11';

        // A, B'yi 4-1 yener.
        TeamMatch::create(['home_team_id' => $a->id, 'away_team_id' => $b->id, 'status' => 'finished',
            'result' => 'home_win', 'home_score' => 4, 'away_score' => 1, 'month_key' => $mk]);
        // A ve C çift-hükmen → ikisine de 0 puan (beraberlik DEĞİL).
        TeamMatch::create(['home_team_id' => $a->id, 'away_team_id' => $c->id, 'status' => 'finished',
            'result' => 'double_forfeit', 'home_score' => 0, 'away_score' => 0, 'month_key' => $mk]);

        $table = app(TeamStandings::class)->monthlyTable($mk);
        $byId = [];
        foreach ($table as $r) {
            $byId[$r['team_id']] = $r;
        }
        $this->assertSame(3, $byId[$a->id]['pts']); // tek galibiyet; çift-hükmen 0 eklemez
        $this->assertEqualsWithDelta(3.0, $byId[$a->id]['diff'], 1e-9);
        $this->assertSame(0, $byId[$b->id]['pts']);
        $this->assertSame(0, $byId[$c->id]['pts']);
        $this->assertSame(2, $byId[$a->id]['played']); // çift-hükmen de oynanmış sayılır
        $this->assertSame(1, $byId[$a->id]['rank']);

        // Ödül dağıtımı idempotent: ikinci çalıştırma yeni kupa üretmez.
        $std = app(TeamStandings::class);
        $first = $std->distributeMonthlyAwards($mk);
        $this->assertGreaterThan(0, $first);
        $this->assertSame(0, $std->distributeMonthlyAwards($mk), 'tekrar çalışınca mükerrer ödül yok');
        $this->assertTrue($a->fresh()->isChampionNow(), 'şampiyon rozeti aktif');
    }

    public function test_tied_champions_both_get_badge(): void
    {
        $a = $this->teamWith('A', 'AAA', [1500]);
        $b = $this->teamWith('B', 'BBB', [1500]);
        $mk = '2026-11';
        // İki ayrı rakibe karşı aynı skorla galip → A ve B ortak birinci.
        $x = $this->teamWith('X', 'XXX', [1500]);
        $y = $this->teamWith('Y', 'YYY', [1500]);
        TeamMatch::create(['home_team_id' => $a->id, 'away_team_id' => $x->id, 'status' => 'finished',
            'result' => 'home_win', 'home_score' => 3, 'away_score' => 2, 'month_key' => $mk]);
        TeamMatch::create(['home_team_id' => $b->id, 'away_team_id' => $y->id, 'status' => 'finished',
            'result' => 'home_win', 'home_score' => 3, 'away_score' => 2, 'month_key' => $mk]);

        app(TeamStandings::class)->distributeMonthlyAwards($mk);
        $this->assertTrue($a->fresh()->isChampionNow());
        $this->assertTrue($b->fresh()->isChampionNow());
    }

    // ---- yardımcı ----------------------------------------------------------

    private function assertThrowsCode(string $code, callable $fn): void
    {
        try {
            $fn();
            $this->fail("TeamException($code) beklendi ama atılmadı");
        } catch (TeamException $e) {
            $this->assertSame($code, $e->errorCode, "beklenen kod '$code', gelen '{$e->errorCode}'");
        }
    }
}
