<?php

namespace App\Console\Commands;

use App\Models\Room;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Read-only production check for the one-active-money-room invariant. */
class AuditMoneyClaims extends Command
{
    protected $signature = 'security:money-claims';

    protected $description = 'Read-only audit of active money rooms and user claim rows.';

    public function handle(): int
    {
        if (! Schema::hasTable('active_money_match_claims')) {
            $this->error('active_money_match_claims table is missing; no audit performed.');

            return self::FAILURE;
        }

        $driver = DB::connection()->getDriverName();
        $this->line('db_driver='.$driver);
        if ($driver === 'mysql') {
            $version = DB::selectOne('select version() as version');
            $this->line('db_version='.(string) ($version->version ?? 'unknown'));
            try {
                $isolation = DB::selectOne('select @@transaction_isolation as isolation');
            } catch (\Throwable) {
                // Older MySQL/MariaDB exposes the same setting as tx_isolation.
                $isolation = DB::selectOne('select @@tx_isolation as isolation');
            }
            $this->line('transaction_isolation='.(string) ($isolation->isolation ?? 'unknown'));
        }
        if ($driver === 'mysql') {
            $indexes = DB::select("select index_name, non_unique, column_name from information_schema.statistics where table_schema = database() and table_name = 'active_money_match_claims' order by index_name, seq_in_index");
            $uniqueUserIndex = collect($indexes)->first(fn ($index) => (int) $index->non_unique === 0 && $index->column_name === 'user_id');
            $this->line('unique_user_claim_index='.($uniqueUserIndex ? 'present' : 'missing'));
        } else {
            $this->line('unique_user_claim_index=not_checked_non_mysql');
        }

        $rooms = Room::query()
            ->whereIn('status', ['playing', 'mm_waiting'])
            ->where(function ($q) {
                $q->where('stake', '>', 0)->orWhere('bet_pct', '>', 0);
                if (Schema::hasColumn('rooms', 'escrowed')) {
                    $q->orWhere('escrowed', true);
                }
            })
            ->get(['id', 'code', 'status', 'p1_user_id', 'p2_user_id']);

        $duplicateParticipants = Room::query()
            ->whereNotNull('p1_user_id')
            ->whereColumn('p1_user_id', 'p2_user_id')
            ->count();

        $expected = [];
        $duplicateUsers = [];
        foreach ($rooms as $room) {
            foreach (array_filter([(int) $room->p1_user_id, (int) $room->p2_user_id]) as $userId) {
                if (isset($expected[$userId]) && $expected[$userId] !== (int) $room->id) {
                    $duplicateUsers[$userId] = true;
                }
                $expected[$userId] = (int) $room->id;
            }
        }

        $claims = DB::table('active_money_match_claims')->get(['user_id', 'room_id']);
        $claimByUser = $claims->keyBy('user_id');
        $missing = [];
        $stale = [];
        foreach ($expected as $userId => $roomId) {
            if (! isset($claimByUser[$userId])) {
                $missing[$userId] = $roomId;
            } elseif ((int) $claimByUser[$userId]->room_id !== $roomId) {
                $stale[$userId] = ['expected' => $roomId, 'actual' => (int) $claimByUser[$userId]->room_id];
            }
        }
        foreach ($claims as $claim) {
            if (! isset($expected[(int) $claim->user_id])) {
                $stale[(int) $claim->user_id] = ['expected' => null, 'actual' => (int) $claim->room_id];
            }
        }

        $this->line('active_money_rooms='.count($rooms));
        $this->line('claim_rows='.$claims->count());
        $this->line('duplicate_active_users='.count($duplicateUsers));
        $this->line('duplicate_room_participants='.$duplicateParticipants);
        $this->line('missing_claims='.count($missing));
        $this->line('stale_claims='.count($stale));

        foreach ($duplicateUsers as $userId => $_) {
            $this->warn("duplicate_active_user={$userId}");
        }
        foreach ($missing as $userId => $roomId) {
            $this->warn("missing_claim user={$userId} room={$roomId}");
        }
        foreach ($stale as $userId => $row) {
            $this->warn("stale_claim user={$userId} expected=".($row['expected'] ?? 'none')." actual={$row['actual']}");
        }

        return ($duplicateUsers || $duplicateParticipants || $missing || $stale) ? self::FAILURE : self::SUCCESS;
    }
}
