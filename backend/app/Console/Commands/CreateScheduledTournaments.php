<?php

namespace App\Console\Commands;

use App\Models\Tournament;
use App\Models\TournamentSchedule;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * PERİYODİK TURNUVA KURUCU: her gece 00:00'da (routes/console.php -> dailyAt('00:00')) koşar.
 * Bugünün ISO gününe (1=Pzt..7=Paz) denk gelen AKTİF şablonlardan birer turnuva kurar; register_until
 * = bugün + şablonun start_time saati (TR). Tournament.register_until'a bağlı mevcut autoStartDue()
 * o saatte (2+ oyuncuyla) turnuvayı otomatik başlatır. last_created_on günlük damga ile tekrar kurmayı
 * önler (aynı gün ikinci çalıştırma / retry no-op).
 */
class CreateScheduledTournaments extends Command
{
    protected $signature = 'tournaments:create-scheduled';

    protected $description = 'Periyodik turnuva şablonlarından bugüne denk gelenleri otomatik kurar (gece 00:00 cron)';

    public function handle(): int
    {
        $today = Carbon::now();           // app.timezone = Europe/Istanbul
        $iso = $today->dayOfWeekIso;      // 1=Pzt .. 7=Paz
        $created = 0;

        $schedules = TournamentSchedule::where('active', true)->get()
            // weekdays Filament CheckboxList'ten STRING gelir (["1","2"]) -> strict in_array int $iso ile
            // asla eşleşmezdi; intval'a normalize et (kurucu bu yüzden hiç çalışmıyordu).
            ->filter(fn (TournamentSchedule $s) => in_array($iso, array_map('intval', $s->weekdays ?? []), true))
            ->filter(fn (TournamentSchedule $s) => ! ($s->last_created_on && $s->last_created_on->isSameDay($today)));

        foreach ($schedules as $s) {
            $registerUntil = $today->copy()->setTimeFromTimeString($s->start_time ?: '20:00');

            Tournament::create([
                'name' => $s->name.' — '.$today->format('d.m.Y'),
                'type' => $s->type,
                'venue' => $s->venue,
                'organizer_id' => $s->organizer_id,
                'size' => $s->size,
                'status' => 'open',
                'active' => true,
                'register_until' => $registerUntil,
                'creator_id' => $s->creator_id,
                'prize_coins' => $s->prize_coins,
                'prize_desc' => $s->prize_desc,
                'prizes' => $s->prizes,
                'entry_fee' => $s->entry_fee,
                'premium_only' => $s->premium_only,
                'match_length' => $s->match_length,
                'semi_length' => $s->semi_length,
                'final_length' => $s->final_length,
                'round_minutes' => $s->round_minutes,
                'semi_minutes' => $s->semi_minutes,
                'final_minutes' => $s->final_minutes,
            ]);

            $s->update(['last_created_on' => $today->toDateString()]);
            $created++;
            $this->info("Kuruldu: {$s->name} (register_until {$registerUntil->format('d.m.Y H:i')})");
        }

        $this->info("Toplam {$created} periyodik turnuva kuruldu.");

        return self::SUCCESS;
    }
}
