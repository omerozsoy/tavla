<?php

namespace App\Console\Commands;

use App\Models\Tournament;
use App\Models\TournamentAnnouncement;
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

        foreach (TournamentSchedule::where('active', true)->get() as $s) {
            // weekdays Filament CheckboxList'ten STRING gelir (["1","2"]) -> int'e normalize et.
            $weekdays = array_filter(array_map('intval', $s->weekdays ?? []), fn ($d) => $d >= 1 && $d <= 7);
            // Aynı gün (günlük) / aynı hafta-başı (haftalık) ikinci çalıştırmada tekrar kurma (idempotent).
            if ($s->last_created_on && $s->last_created_on->isSameDay($today)) {
                continue;
            }

            if (($s->frequency ?? 'daily') === 'weekly') {
                // HAFTALIK: yalnız Pazartesi (hafta başı) koşar; o haftanın TÜM seçili günleri için
                // birer turnuva kurar (her biri kendi gününün start_time saatinde başlar).
                if ($iso !== 1) {
                    continue;
                }
                $monday = $today->copy()->startOfWeek(Carbon::MONDAY);
                foreach ($weekdays as $wd) {
                    $registerUntil = $monday->copy()->addDays($wd - 1)->setTimeFromTimeString($s->start_time ?: '20:00');
                    $this->makeTournament($s, $registerUntil);
                    $created++;
                }
            } else {
                // GÜNLÜK: bugüne denk gelen günde o günün turnuvasını kurar.
                if (! in_array($iso, $weekdays, true)) {
                    continue;
                }
                $registerUntil = $today->copy()->setTimeFromTimeString($s->start_time ?: '20:00');
                $this->makeTournament($s, $registerUntil);
                $created++;
            }

            $s->update(['last_created_on' => $today->toDateString()]);
        }

        $this->info("Toplam {$created} periyodik turnuva kuruldu.");

        return self::SUCCESS;
    }

    /** Şablondan tek turnuva kurar; adına register_until'ın tarihini ekler. */
    private function makeTournament(TournamentSchedule $s, Carbon $registerUntil): void
    {
        $t = Tournament::create([
            'name' => $s->name.' — '.$registerUntil->format('d.m.Y'),
            'type' => $s->type,
            'swiss_lives' => $s->swiss_lives ?? 3, // 3 Haklı Swiss hak sayısı (bracket yok sayar)
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
            'third_place_match' => $s->third_place_match,
            'match_length' => $s->match_length,
            'semi_length' => $s->semi_length,
            'final_length' => $s->final_length,
            'round_minutes' => $s->round_minutes,
            'semi_minutes' => $s->semi_minutes,
            'final_minutes' => $s->final_minutes,
        ]);

        // Standart duyuru metnini KURULUŞTA yayınla (tipine göre) -> kayıt penceresi boyunca lobide görünür.
        // Idempotent: başlayınca (startBracket/SwissRuntime::start) publishStandard zaten-duyuru-var deyip atlar.
        TournamentAnnouncement::publishStandard($t, $s->type === 'bracket' ? 'tournament_std_bracket' : 'tournament_std_swiss');

        $this->info("Kuruldu: {$s->name} (register_until {$registerUntil->format('d.m.Y H:i')})");
    }
}
