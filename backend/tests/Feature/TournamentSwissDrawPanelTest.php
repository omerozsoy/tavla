<?php

namespace Tests\Feature;

use App\Filament\Resources\TournamentResource\Pages\ManageTournament;
use App\Models\Tournament;
use App\Models\User;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Filament paneli "Tur Tarih/Saati" + "Kura Çek" aksiyonları (manuel kura akışı). Guard'lar:
 * tarih/saati girilmemiş turun kurası çekilemez; bir turdaki tüm maçlar bitmeden kura çekilemez.
 */
class TournamentSwissDrawPanelTest extends TestCase
{
    use RefreshDatabase;

    private static int $seq = 0;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'adm'.(++self::$seq), 'email' => 'adm'.self::$seq.'@e.com',
            'password' => bcrypt('secret123'), 'first_name' => 'A', 'last_name' => 'T', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    private function swiss(int $n): Tournament
    {
        $g = ++self::$seq;
        $players = [];
        for ($i = 1; $i <= $n; $i++) {
            $u = User::create([
                'nickname' => "dr{$g}_$i", 'email' => "dr{$g}_$i@e.com", 'password' => bcrypt('secret123'),
                'first_name' => "P$i", 'last_name' => 'T', 'country' => 'TR', 'rating' => 1500 + $i,
            ]);
            $players[] = ['id' => $u->id, 'name' => "dr{$g}_$i", 'rating' => 1500 + $i, 'premium' => false];
        }

        return Tournament::create([
            'name' => "Draw $n", 'type' => 'swiss_triple', 'size' => 0, 'status' => 'open',
            'players' => $players, 'match_length' => 5,
        ]);
    }

    public function test_admin_draw_flow_schedule_then_draw_with_guards(): void
    {
        $t = $this->swiss(4);
        SwissRuntime::start($t);
        $t->refresh();
        $this->assertCount(0, $t->bracket ?? [], 'Başlatınca kura otomatik çekilmez');

        $admin = $this->admin();

        // (1) Saat girilmeden "Başlat" → tur oluşmaz (guard: no_datetime).
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', [])
            ->call('startRound', 1);
        $this->assertCount(0, $t->fresh()->bracket ?? [], 'Saatsiz tur başlamamalı');

        // (2+3) 1. turun saatini gir + "Başlat" → 1. tur çekilir, planlanan tarih schedule'a yazılır.
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00'])
            ->call('startRound', 1);
        $t->refresh();
        $this->assertCount(1, $t->bracket, '1. tur çekildi');
        $this->assertStringStartsWith('2026-11-05 20:00', (string) ($t->swiss_state['schedule']['1'] ?? ''), 'Planlanan tarih kaydedildi');
        $this->assertNull($t->swiss_state['next_at'] ?? null, 'next_at temizlendi');

        // (4) Tur maçları bitmeden 2. turu "Başlat" → ÇEKİLMEZ (guard: round_incomplete), saat verilse bile.
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00', '2' => '2026-11-06T20:00'])
            ->call('startRound', 2);
        $this->assertCount(1, $t->fresh()->bracket, 'Tur bitmeden 2. tur çekilmemeli');
    }

    public function test_schedule_all_rounds_upfront(): void
    {
        $t = $this->swiss(4);
        SwissRuntime::start($t);

        // Tüm turları (1 ve 2) TEK seferde liste üzerinden kaydet ("Saatleri Kaydet").
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00', '2' => '2026-11-06T20:00'])
            ->call('saveTimes');
        $t->refresh();
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['schedule']['1'] ?? null);
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null);
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['next_at'] ?? null, 'sıradaki turun saati next_at\'e yansır');

        // 1. turu "Başlat" → schedule[1] ile çekilir; 2. tur planı korunur.
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00', '2' => '2026-11-06T20:00'])
            ->call('startRound', 1);
        $t->refresh();
        $this->assertCount(1, $t->bracket, '1. tur çekildi');
        $this->assertNull($t->swiss_state['next_at'] ?? null, 'çekildikten sonra next_at temizlenir');
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null, '2. tur planı korunur');
    }

    public function test_clear_time_removes_round_schedule_and_next_at(): void
    {
        $t = $this->swiss(4);
        SwissRuntime::start($t);
        // 1. ve 2. tur planlı.
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00', '2' => '2026-11-06T20:00'])
            ->call('saveTimes');
        $this->assertSame('2026-11-05 20:00:00', $t->fresh()->swiss_state['next_at'] ?? null);

        // 1. turun saatini SİL → schedule'dan düşer + next_at temizlenir (kura şartı kalkar).
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->call('clearTime', 1);
        $t->refresh();
        $this->assertArrayNotHasKey('1', $t->swiss_state['schedule'] ?? [], '1. tur saati silindi');
        $this->assertNull($t->swiss_state['next_at'] ?? null, 'silinince next_at temizlenir');
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null, '2. tur korunur');

        // Saati silinen 1. tur artık çekilemez (no_datetime).
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->call('startRound', 1);
        $this->assertCount(0, $t->fresh()->bracket ?? [], 'saatsiz tur çekilmez');
    }

    public function test_schedule_before_start_is_preserved_on_start(): void
    {
        // Open (başlamamış) turnuvada tur saatleri girilir → partial swiss_state'te tutulur, serialize null.
        $t = $this->swiss(4); // status=open, swiss_state=null
        SwissRuntime::setSchedule($t, ['1' => '2026-11-05 20:00:00', '2' => '2026-11-06 20:00:00']);
        $t->refresh();
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['schedule']['1'] ?? null, 'open\'da plan saklanır');
        $this->assertNull(SwissRuntime::serialize($t), 'participants yok → frontend swiss paneli null (güvenli)');

        // Başlatınca plan KORUNUR; 1. tur planı next_at\'e yansır (kura şartı hazır).
        SwissRuntime::start($t);
        $t->refresh();
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['schedule']['1'] ?? null, 'plan başlatınca korunur');
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null);
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['next_at'] ?? null, '1. tur planı next_at\'e geçer');
        $this->assertNotEmpty($t->swiss_state['participants'] ?? null, 'başlatma katılımcıları kurar');
    }

    public function test_start_tournament_action_draws_round1_when_time_set(): void
    {
        // Açık Swiss: 1. tur saatini listeye gir + "Turnuvayı Başlat" → turnuva başlar VE 1. tur çekilir (tek tık).
        $sw = $this->swiss(4);
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $sw->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00'])
            ->callAction('start');
        $sw->refresh();
        $this->assertSame('running', $sw->status, 'turnuva başlar');
        $this->assertCount(1, $sw->bracket, '1. tur kurası da çekilir');
    }

    public function test_start_tournament_without_round1_time_starts_only(): void
    {
        // 1. tur saati girilmeden "Turnuvayı Başlat" → turnuva başlar ama 1. tur çekilmez; sonra listeden.
        $sw = $this->swiss(4);
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $sw->id])
            ->set('roundTimes', [])
            ->callAction('start');
        $sw->refresh();
        $this->assertSame('running', $sw->status);
        $this->assertCount(0, $sw->bracket ?? [], 'saat yoksa 1. tur çekilmez');

        // Şimdi 1. turu listeden saat girip "Başlat".
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $sw->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00'])
            ->call('startRound', 1);
        $this->assertCount(1, $sw->fresh()->bracket, '1. tur çekildi');
    }

    public function test_round_start_is_swiss_only(): void
    {
        // ELEME AĞACI turnuvada Swiss listesi yok → startRound dokunmaz (yalnız Swiss).
        $base = $this->swiss(4);
        $br = Tournament::create([
            'name' => 'Br', 'type' => 'bracket', 'size' => 0, 'status' => 'open',
            'players' => $base->players, 'match_length' => 5,
        ]);
        $br->startBracket();
        $before = $br->fresh()->bracket;
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $br->id])
            ->set('roundTimes', ['1' => '2026-11-05T20:00'])
            ->call('startRound', 1);
        $this->assertSame($before, $br->fresh()->bracket, 'bracket startRound\'a dokunmaz');
    }
}
