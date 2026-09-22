<?php

namespace App\Console\Commands;

use App\Models\Room;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Read-only inventory of dice authority and legacy room coverage. */
class AuditDiceAuthority extends Command
{
    protected $signature = 'security:dice-authority-audit';

    protected $description = 'Read-only audit of production dice authority coverage.';

    public function handle(): int
    {
        $this->line('server_authoritative_config='.(config('game.server_authoritative') ? 'true' : 'false'));
        $this->line('legacy_state_allowed='.(config('game.legacy_state_allowed') ? 'true' : 'false'));
        $this->line('validator_required='.(config('validator.required', true) ? 'true' : 'false'));
        $this->line('dice_enforce='.(config('game.server_authoritative') ? 'true' : 'false'));

        if (! Schema::hasTable('rooms')) {
            $this->line('rooms_table=missing');
            return self::FAILURE;
        }
        $rooms = Room::query()->whereIn('status', ['mm_waiting', 'playing'])->get([
            'id', 'code', 'status', 'mode', 'stake', 'bet_pct', 'authoritative', 'dice_authority',
        ]);
        $this->line('active_rooms='.$rooms->count());
        $this->line('active_authoritative_rooms='.$rooms->where('authoritative', true)->count());
        $this->line('active_legacy_rooms='.$rooms->where('authoritative', false)->count());
        if (Schema::hasColumn('rooms', 'dice_authority')) {
            $this->line('active_dice_authority_rooms='.$rooms->where('dice_authority', true)->count());
        } else {
            $this->line('dice_authority_column=missing');
        }

        $legacy = $rooms->where('authoritative', false);
        foreach ($legacy as $room) {
            $this->warn('legacy_active_room='.$room->code.' status='.$room->status.' mode='.$room->mode);
        }

        return self::SUCCESS;
    }
}
