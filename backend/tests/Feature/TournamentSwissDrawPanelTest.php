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

        // (1) Tarih/saat girilmeden "Kura Çek" → tur oluşmaz (guard: no_datetime).
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->callAction('drawRound')
            ->assertHasNoActionErrors();
        $this->assertCount(0, $t->fresh()->bracket ?? [], 'Tarihsiz kura çekilmemeli');

        // (2) 1. turun saatini planla (schedule). Form DateTimePicker'ı headless testte hydrate olmaz;
        // servis katmanı (setSchedule) doğrudan test edilir — panel formu ince glue.
        SwissRuntime::setSchedule($t->fresh(), ['1' => '2026-11-05 20:00:00']);
        $this->assertNotEmpty($t->fresh()->swiss_state['next_at'] ?? null, 'Sıradaki tur saati next_at\'e yansımalı');

        // (3) "Kura Çek" → 1. tur oluşur, planlanan tarih schedule'a yazılır, next_at temizlenir.
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->callAction('drawRound')
            ->assertHasNoActionErrors();
        $t->refresh();
        $this->assertCount(1, $t->bracket, '1. tur çekildi');
        $this->assertStringStartsWith('2026-11-05 20:00', (string) ($t->swiss_state['schedule']['1'] ?? ''), 'Planlanan tarih kaydedildi');
        $this->assertNull($t->swiss_state['next_at'] ?? null, 'next_at temizlendi');

        // (4) Tur maçları bitmeden "Kura Çek" → yeni tur ÇEKİLMEZ (guard: round_incomplete), tarih verilse bile.
        SwissRuntime::setSchedule($t->fresh(), ['1' => '2026-11-05 20:00:00', '2' => '2026-11-06 20:00:00']);
        Livewire::actingAs($admin)
            ->test(ManageTournament::class, ['record' => $t->id])
            ->callAction('drawRound')
            ->assertHasNoActionErrors();
        $this->assertCount(1, $t->fresh()->bracket, 'Tur bitmeden 2. tur çekilmemeli');
    }

    public function test_schedule_all_rounds_upfront(): void
    {
        $t = $this->swiss(4);
        SwissRuntime::start($t);

        // Tüm turları (1 ve 2) TEK seferde planla. Panel "Tur Saatleri" formu setSchedule çağırır;
        // burada servis doğrudan test edilir (DateTimePicker repeater headless hydrate olmaz).
        SwissRuntime::setSchedule($t, ['1' => '2026-11-05 20:00:00', '2' => '2026-11-06 20:00:00']);
        $t->refresh();
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['schedule']['1'] ?? null);
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null);
        $this->assertSame('2026-11-05 20:00:00', $t->swiss_state['next_at'] ?? null, 'sıradaki turun saati next_at\'e yansır');

        // 1. tur, ayrıca next_at girmeye gerek kalmadan schedule[1] ile çekilir; 2. tur planı korunur.
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $t->id])
            ->callAction('drawRound')
            ->assertHasNoActionErrors();
        $t->refresh();
        $this->assertCount(1, $t->bracket, '1. tur çekildi');
        $this->assertNull($t->swiss_state['next_at'] ?? null, 'çekildikten sonra next_at temizlenir');
        $this->assertSame('2026-11-06 20:00:00', $t->swiss_state['schedule']['2'] ?? null, '2. tur planı korunur');
    }

    public function test_draw_actions_hidden_for_non_running_or_bracket(): void
    {
        // Açık (henüz başlamamış) Swiss turnuvada aksiyonlar gizli.
        $open = $this->swiss(4);
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $open->id])
            ->assertActionHidden('drawRound')
            ->assertActionHidden('scheduleRound');

        // Sürüyor ama ELEME AĞACI turnuvada aksiyonlar gizli (yalnız Swiss).
        $br = Tournament::create([
            'name' => 'Br', 'type' => 'bracket', 'size' => 0, 'status' => 'open',
            'players' => $open->players, 'match_length' => 5,
        ]);
        $br->startBracket();
        Livewire::actingAs($this->admin())
            ->test(ManageTournament::class, ['record' => $br->id])
            ->assertActionHidden('drawRound')
            ->assertActionHidden('scheduleRound');
    }
}
