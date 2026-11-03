<?php

namespace App\Console\Commands;

use App\Models\LeagueMatch;
use App\Models\LeagueSeason;
use App\Support\League\LeagueNotifier;
use App\Support\League\LeagueRuntime;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Türkiye Online Tavla Ligi dakikalık nöbetçi (§9/§14/§4). TEKRAR-ÇALIŞTIRILABİLİR (idempotent):
 *  1) Oda sonuçlarını yakala (§4) — otoriter oda biten pending maçları işler.
 *  2) 15 dk hazır-olma penceresi kararları (§9) — hükmen/çift-gelmeme.
 *  3) Ön eleme bitince son 16'yı kur + ağacı ilerlet + final kapanırsa bitir (ödül).
 *  4) Hatırlatmalar (§14): yeni eşleşme + randevudan 24s/1s önce (geçmiş hatırlatmaları topluca atmaz).
 *
 * Hiçbir adım diğerini bozmaz (her biri try/catch); push/e-posta hatası sonucu etkilemez.
 */
class LeagueTick extends Command
{
    protected $signature = 'league:tick';

    protected $description = 'Türkiye Online Tavla Ligi: oda sonucu yakala, 15dk hükmen, eleme ilerlet, hatırlatma gönder';

    /** Hatırlatma penceresi toleransı (tick ~dakikada bir; işaretin yakınında bir kez tetikle). */
    private const GRACE_SEC = 120;

    public function handle(): int
    {
        $season = LeagueSeason::whereIn('status', ['league', 'knockout'])->first();
        if (! $season) {
            return self::SUCCESS;
        }
        $now = now();

        // 1) Oda sonuçlarını yakala (room_code'lu pending maçlar).
        foreach (LeagueMatch::where('season_id', $season->id)->where('result', 'pending')
            ->whereNotNull('room_code')->get() as $m) {
            $this->safe(fn () => LeagueRuntime::captureRoomResult($m));
        }

        // 2) 15 dk hazır-olma penceresi (takvimli, pending maçlar).
        foreach (LeagueMatch::where('season_id', $season->id)->where('result', 'pending')
            ->whereNotNull('p2_user_id')->get() as $m) {
            $this->safe(fn () => LeagueRuntime::resolveReadyWindow($m, $now));
        }

        // 3) Eleme: ön eleme bitince son 16'yı kur; ağacı ilerlet; final kapanırsa bitir + ödül.
        if ($season->status === 'knockout') {
            $prelimPending = LeagueMatch::where('season_id', $season->id)->where('phase', 'prelim')
                ->where('result', 'pending')->exists();
            $r16Missing = ! LeagueMatch::where('season_id', $season->id)->where('phase', 'r16')->exists();
            if (! $prelimPending && $r16Missing) {
                $this->safe(fn () => LeagueRuntime::buildKnockout($season));
            }
            $this->safe(fn () => LeagueRuntime::advanceKnockout($season->refresh()));
        }

        // 4) Hatırlatmalar (§14).
        $this->sendReminders($season, $now);

        return self::SUCCESS;
    }

    private function sendReminders(LeagueSeason $season, Carbon $now): void
    {
        foreach (LeagueMatch::where('season_id', $season->id)->where('result', 'pending')
            ->whereNotNull('p1_user_id')->whereNotNull('p2_user_id')->get() as $m) {
            // Yeni (kesinleşmiş) eşleşme bildirimi — maç başına bir kez (çıpa=sabit başlangıç/oluşturulma).
            $anchorNew = $m->effectiveStartAt() ?? $m->created_at;
            $this->safe(fn () => LeagueNotifier::fire(
                $m, 'new_pairing', $anchorNew,
                'Yeni lig eşleşmen', 'Lig maçın belirlendi. Takvimi ve rakibini lig sayfandan gör.'
            ));

            $start = $m->effectiveStartAt();
            if (! $start) {
                continue;
            }
            $secToStart = $start->getTimestamp() - $now->getTimestamp();
            // 24 saat işareti: yalnız işaretin yakınında (geçmiş hatırlatmaları topluca atma).
            if ($secToStart > 86400 - self::GRACE_SEC && $secToStart <= 86400) {
                $this->safe(fn () => LeagueNotifier::fire($m, 'remind_24h', $start,
                    'Lig maçın yaklaşıyor', 'Lig maçın 24 saat içinde. Randevu saatinde hazır ol.'));
            }
            // 1 saat işareti.
            if ($secToStart > 3600 - self::GRACE_SEC && $secToStart <= 3600) {
                $this->safe(fn () => LeagueNotifier::fire($m, 'remind_1h', $start,
                    'Lig maçına 1 saat', 'Lig maçın 1 saat içinde başlıyor. Maç odanda "Hazırım" de.'));
            }
        }
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
