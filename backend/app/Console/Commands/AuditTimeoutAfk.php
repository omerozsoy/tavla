<?php

namespace App\Console\Commands;

use App\Models\Room;
use App\Services\MatchClock;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/** Read-only production evidence for server-authoritative timeout/AFK handling. */
class AuditTimeoutAfk extends Command
{
    protected $signature = 'security:timeout-afk-audit';

    protected $description = 'Audit server-authoritative timeout/AFK coverage without mutating rooms.';

    public function handle(): int
    {
        $serverAuthoritative = (bool) config('game.server_authoritative', false);
        $legacyAllowed = (bool) config('game.legacy_state_allowed', true);
        $clockService = class_exists(MatchClock::class);
        $heartbeat = $this->heartbeatAge('ops:cron:heartbeat');
        $heartbeatFresh = is_int($heartbeat) && $heartbeat <= 180;

        $this->line('server_authoritative_config='.($serverAuthoritative ? 'true' : 'false'));
        $this->line('legacy_state_allowed='.($legacyAllowed ? 'true' : 'false'));
        $this->line('match_clock_service='.($clockService ? 'present' : 'missing'));
        $this->line('cron_heartbeat_age_seconds='.($heartbeat === null ? 'unknown' : (string) $heartbeat));
        $this->line('cron_heartbeat_fresh='.($heartbeatFresh ? 'true' : 'false'));

        if (! Schema::hasTable('rooms')) {
            $this->line('rooms_table=missing');
            $this->line('timeout_afk_result=UNKNOWN');
            return self::SUCCESS;
        }

        $this->line('rooms_table=present');
        $active = Room::query()->where('status', 'playing')->get([
            'authoritative', 'clock', 'server_state', 'server_match', 'bot',
        ]);
        $activeTotal = $active->count();
        $activeAuthoritative = $active->filter(fn (Room $room): bool => (bool) $room->authoritative)->count();
        $activeLegacy = $activeTotal - $activeAuthoritative;
        $activeClocked = $active->filter(fn (Room $room): bool => is_array($room->clock) && $room->clock !== [])->count();
        $activeClockless = $activeTotal - $activeClocked;

        $this->line('active_rooms='.$activeTotal);
        $this->line('active_authoritative_rooms='.$activeAuthoritative);
        $this->line('active_legacy_rooms='.$activeLegacy);
        $this->line('active_clocked_rooms='.$activeClocked);
        $this->line('active_clockless_rooms='.$activeClockless);

        $pass = $serverAuthoritative
            && ! $legacyAllowed
            && $clockService
            && $heartbeatFresh
            && $activeLegacy === 0;
        $this->line('timeout_afk_result='.($pass ? 'PASS' : 'UNKNOWN'));

        return self::SUCCESS;
    }

    private function heartbeatAge(string $key): ?int
    {
        $value = Cache::get($key);
        if (! is_numeric($value) || (int) $value <= 0) {
            return null;
        }

        return max(0, time() - (int) $value);
    }
}
