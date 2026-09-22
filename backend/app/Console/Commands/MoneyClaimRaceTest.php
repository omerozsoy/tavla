<?php

namespace App\Console\Commands;

use App\Models\Room;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

/**
 * Controlled, self-cleaning DB race test for the one-active-money-room claim.
 * It never touches wallet balances or settlement rows.
 */
class MoneyClaimRaceTest extends Command
{
    protected $signature = 'security:money-claim-race
        {--child : Internal child invocation; do not use directly}
        {--user-id= : Internal test user id}
        {--room-id= : Internal test room id}
        {--result-file= : Internal child result file}';

    protected $description = 'Run a self-cleaning parallel active money-match claim test.';

    public function handle(): int
    {
        if ($this->option('child')) {
            return $this->runChild();
        }

        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->error('This proof requires the production MySQL/MariaDB driver.');
            return self::FAILURE;
        }
        if (! function_exists('proc_open')) {
            $this->error('proc_open is required to start isolated concurrent DB connections.');
            return self::FAILURE;
        }

        // rooms.code is varchar(8) in production: keep the generated codes within that limit.
        $suffix = strtoupper(substr(bin2hex(random_bytes(6)), 0, 4));
        $user = null;
        $rooms = [];
        $files = [];
        $processes = [];
        try {
            $user = User::create([
                'first_name' => 'SECURITY', 'last_name' => 'RACE',
                'country' => '', 'nickname' => 'sec_race_'.$suffix,
                'email' => 'security-race-'.$suffix.'@invalid.test',
                'password' => bin2hex(random_bytes(24)),
            ]);
            foreach (['A', 'B'] as $label) {
                $rooms[$label] = Room::create([
                    'code' => 'SR'.$suffix.$label,
                    'p1_token' => 'security-race-'.$suffix,
                    'p1_name' => 'SECURITY RACE',
                    'status' => 'playing', 'stake' => 1, 'mode' => 'ranked', 'version' => 0,
                ]);
            }

            foreach ([$rooms['A']->id, $rooms['B']->id] as $roomId) {
                $file = tempnam(sys_get_temp_dir(), 'tavla-claim-race-');
                $files[] = $file;
                $process = new Process([
                    PHP_BINARY, base_path('artisan'), 'security:money-claim-race',
                    '--child', '--user-id='.$user->id, '--room-id='.$roomId,
                    '--result-file='.$file,
                ], base_path());
                $process->setTimeout(30);
                $process->start();
                $processes[] = $process;
            }
            foreach ($processes as $process) {
                $process->wait();
                if (! $process->isSuccessful()) {
                    $this->error(trim($process->getErrorOutput() ?: $process->getOutput()));
                    return self::FAILURE;
                }
            }

            $results = collect($files)->map(fn (string $file) => json_decode((string) file_get_contents($file), true) ?: [])->all();
            $wins = collect($results)->where('claimed', true)->count();
            $losses = collect($results)->where('claimed', false)->count();
            $rows = DB::table('active_money_match_claims')->where('user_id', $user->id)->count();
            $this->line('parallel_attempts=2');
            $this->line('successful_claims='.$wins);
            $this->line('rejected_claims='.$losses);
            $this->line('claim_rows_before_cleanup='.$rows);
            $passed = $wins === 1 && $losses === 1 && $rows === 1;
            $this->line('race_result='.($passed ? 'PASS' : 'FAIL'));
            return $passed ? self::SUCCESS : self::FAILURE;
        } finally {
            foreach ($files as $file) {
                if (is_string($file) && is_file($file)) @unlink($file);
            }
            if ($user) {
                DB::table('active_money_match_claims')->where('user_id', $user->id)->delete();
                foreach ($rooms as $room) $room->delete();
                $user->delete();
            }
            $this->line('cleanup=complete');
        }
    }

    private function runChild(): int
    {
        $claimed = Room::claimActiveMoneySlot((int) $this->option('user-id'), (int) $this->option('room-id'));
        $file = (string) $this->option('result-file');
        file_put_contents($file, json_encode(['claimed' => $claimed], JSON_THROW_ON_ERROR));
        return self::SUCCESS;
    }
}
