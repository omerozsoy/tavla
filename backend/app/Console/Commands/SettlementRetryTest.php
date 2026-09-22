<?php

namespace App\Console\Commands;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

/** Self-cleaning concurrent settlement/retry proof; no production account is used. */
class SettlementRetryTest extends Command
{
    protected $signature = 'security:settlement-retry-test
        {--child : Internal child invocation; do not use directly}
        {--room-id= : Internal test room id}
        {--user-id= : Internal caller user id}
        {--token= : Internal caller token}
        {--code= : Internal test room code}
        {--result-file= : Internal child result file}';

    protected $description = 'Run a self-cleaning concurrent settlement retry test.';

    public function handle(): int
    {
        if ($this->option('child')) {
            return $this->runChild();
        }
        if (DB::connection()->getDriverName() !== 'mysql' || ! function_exists('proc_open')) {
            $this->error('This proof requires MySQL/MariaDB and proc_open.');
            return self::FAILURE;
        }

        $suffix = strtoupper(substr(bin2hex(random_bytes(6)), 0, 4));
        $users = [];
        $room = null;
        $files = [];
        $processes = [];
        try {
            foreach (['winner', 'loser'] as $label) {
                $users[$label] = User::create([
                    'first_name' => 'SECURITY', 'last_name' => strtoupper($label),
                    'country' => '', 'nickname' => 'settle_'.$label.'_'.$suffix,
                    'email' => 'settlement-'.$label.'-'.$suffix.'@invalid.test',
                    'password' => bin2hex(random_bytes(24)),
                ]);
                $users[$label]->coins = 1000;
                $users[$label]->save();
            }
            $room = Room::create([
                'code' => 'ST'.$suffix.'X', 'p1_token' => 'settle-'.$suffix,
                'p1_user_id' => $users['winner']->id, 'p1_name' => 'SECURITY WINNER',
                'p2_token' => 'settle-'.$suffix.'-loser', 'p2_user_id' => $users['loser']->id,
                'p2_name' => 'SECURITY LOSER', 'status' => 'playing', 'mode' => 'ranked',
                'stake' => 10, 'bet_pct' => 0, 'settled' => false, 'escrowed' => false,
                'authoritative' => true, 'server_match' => ['done' => true, 'winner' => 'white'],
                'version' => 0,
            ]);

            foreach ([$users['winner']->id, $users['loser']->id] as $userId) {
                $file = tempnam(sys_get_temp_dir(), 'tavla-settle-test-');
                $files[] = $file;
                $token = (int) $room->p1_user_id === (int) $userId ? $room->p1_token : $room->p2_token;
                $process = new Process([
                    PHP_BINARY, base_path('artisan'), 'security:settlement-retry-test', '--child',
                    '--room-id='.$room->id, '--user-id='.$userId,
                    '--token='.$token,
                    '--code='.$room->code, '--result-file='.$file,
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
            $results = collect($files)->map(fn ($file) => json_decode((string) file_get_contents($file), true) ?: [])->all();
            $room->refresh();
            $settlementRows = DB::table('wallet_transactions')->where('reference_type', Room::class)
                ->where('reference_id', $room->id)->whereIn('type', ['match_settlement_debit', 'match_settlement_credit'])->count();
            $successes = collect($results)->where('already', false)->count();
            $retries = collect($results)->where('already', true)->count();
            $this->line('parallel_attempts=2');
            $this->line('settlement_successes='.$successes);
            $this->line('already_settled_retries='.$retries);
            $this->line('settlement_wallet_rows='.$settlementRows);
            $passed = $successes === 1 && $retries === 1 && $settlementRows === 2 && (bool) $room->settled;
            $this->line('retry_result='.($passed ? 'PASS' : 'FAIL'));
            return $passed ? self::SUCCESS : self::FAILURE;
        } finally {
            foreach ($files as $file) if (is_file($file)) @unlink($file);
            if ($room) {
                DB::table('wallet_transactions')->where('reference_type', Room::class)->where('reference_id', $room->id)->delete();
                DB::table('commissions')->where('room_code', $room->code)->delete();
                if (\Illuminate\Schema\Schema::hasTable('active_money_match_claims')) {
                    DB::table('active_money_match_claims')->where('room_id', $room->id)->delete();
                }
                $room->delete();
            }
            foreach ($users as $user) $user->delete();
            $this->line('cleanup=complete');
        }
    }

    private function runChild(): int
    {
        $user = User::findOrFail((int) $this->option('user-id'));
        $request = Request::create('/api/rooms/'.$this->option('code').'/settle', 'POST', ['token' => $this->option('token'), 'won' => true]);
        $request->setUserResolver(fn () => $user);
        $response = app(RoomController::class)->settle($request, (string) $this->option('code'));
        $payload = method_exists($response, 'getData') ? (array) $response->getData(true) : [];
        file_put_contents((string) $this->option('result-file'), json_encode([
            'already' => (bool) ($payload['ok'] ?? false) === false && ! isset($payload['amount']),
            'status' => $response->getStatusCode(),
        ], JSON_THROW_ON_ERROR));
        return self::SUCCESS;
    }
}
