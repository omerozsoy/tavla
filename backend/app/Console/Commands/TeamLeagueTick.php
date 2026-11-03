<?php

namespace App\Console\Commands;

use App\Models\TeamMatch;
use App\Models\TeamMatchGame;
use App\Models\TeamMatchLineup;
use App\Models\TeamMember;
use App\Support\TeamLeague\TeamMatchRuntime;
use App\Support\TeamLeague\TeamNotifier;
use App\Support\TeamLeague\TeamRules;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Takımlar Ligi dakikalık nöbetçi (§8/§9/§11). TEKRAR-ÇALIŞTIRILABİLİR (idempotent):
 *  1) Kadro kilidi (başlangıca 10 dk kala) — eksik kadro hükmen/iptal.
 *  2) Oyun odası sonucu yakala + 5 dk hazır-olma penceresi (no-show/çift-hükmen) + maçı kesinleştir.
 *  3) Hatırlatmalar: başlangıçtan 30 dk ve 5 dk önce.
 * Sunucu yeniden başlasa bile kaçırılan kilit/başlangıç/no-show buradan toparlanır (§13).
 */
class TeamLeagueTick extends Command
{
    protected $signature = 'teamleague:tick';

    protected $description = 'Takımlar Ligi: kadro kilidi, oda sonucu, hazır-olma/no-show, hatırlatma';

    private const GRACE_SEC = 120;

    public function handle(): int
    {
        $rt = app(TeamMatchRuntime::class);
        $now = now();

        // 1) Kilit penceresi.
        foreach (TeamMatch::where('status', 'scheduled')->whereNull('lineup_locked_at')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', $now->copy()->addMinutes(TeamRules::LOCK_BEFORE_MINUTES))
            ->get() as $m) {
            $this->safe(fn () => $rt->lockMatch($m, $now));
        }

        // 2) Kilitli, bitmemiş maçlar: oyunları çöz + maçı kesinleştir.
        foreach (TeamMatch::whereIn('status', ['scheduled', 'live'])->whereNotNull('lineup_locked_at')->get() as $m) {
            foreach (TeamMatchGame::where('match_id', $m->id)->where('status', '!=', 'finished')->get() as $g) {
                $this->safe(fn () => $rt->captureGameResult($g));
                $g->refresh();
                if ($g->status !== 'finished') {
                    $this->safe(fn () => $rt->resolveGameReadyWindow($m, $g, $now));
                }
            }
            $this->safe(fn () => $rt->tryFinalize((int) $m->id));
        }

        // 3) Hatırlatmalar.
        $this->reminders($now);

        return self::SUCCESS;
    }

    private function reminders(Carbon $now): void
    {
        foreach (TeamMatch::where('status', 'scheduled')->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>', $now)->get() as $m) {
            $start = $m->scheduled_at;
            $sec = $start->getTimestamp() - $now->getTimestamp();
            $recipients = fn () => $this->recipients($m);
            if ($sec > 1800 - self::GRACE_SEC && $sec <= 1800) {
                $this->safe(fn () => TeamNotifier::fire($m->id, 'remind_30m', $start, $recipients(),
                    'Karşılaşmana 30 dk', 'Takım karşılaşman 30 dk içinde. Kadro kilitleniyor, hazır ol.'));
            }
            if ($sec > 300 - self::GRACE_SEC && $sec <= 300) {
                $this->safe(fn () => TeamNotifier::fire($m->id, 'remind_5m', $start, $recipients(),
                    'Karşılaşmana 5 dk', 'Takım karşılaşman 5 dk içinde başlıyor. Maç odanda "Hazırım" de.'));
            }
        }
    }

    /** @return list<int> */
    private function recipients(TeamMatch $m): array
    {
        $managers = TeamMember::whereIn('team_id', [(int) $m->home_team_id, (int) $m->away_team_id])
            ->whereIn('role', ['founder', 'assistant'])->pluck('user_id')->map(fn ($x) => (int) $x)->all();
        $players = TeamMatchLineup::where('match_id', $m->id)->pluck('user_id')->map(fn ($x) => (int) $x)->all();

        return array_values(array_unique(array_merge($managers, $players)));
    }

    private function safe(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
