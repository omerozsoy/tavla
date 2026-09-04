<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * E2E (Playwright) test kurulumu: TEMİZ DB + 2 test kullanıcısı (id 1,2) + Sanctum token.
 * Token'lar storage/app/e2e-users.json'a yazılır; Playwright okuyup localStorage'a enjekte eder.
 * YALNIZ e2e ortamında (APP_ENV=e2e) çalışır — kaza ile prod/dev verisini silmesin.
 */
class E2eSeed extends Command
{
    protected $signature = 'e2e:seed';

    protected $description = 'E2E: temiz test DB + 2 kullanici + token (yalniz APP_ENV=e2e)';

    public function handle(): int
    {
        if (! app()->environment('e2e')) {
            $this->error('e2e:seed yalniz APP_ENV=e2e ortaminda calisir (guvenlik).');

            return self::FAILURE;
        }

        $this->call('migrate:fresh', ['--force' => true]);

        $out = [];
        foreach ([['e2e-p1@test.local', 'W'], ['e2e-p2@test.local', 'B']] as [$email, $nick]) {
            $u = User::create([
                'first_name' => $nick, 'last_name' => 'E2E', 'country' => 'TR',
                'nickname' => $nick, 'email' => $email, 'password' => Hash::make('e2e-pass-123'),
            ]);
            $u->rating = 1500;
            $u->coins = 100000; // bahisli eşleşme için yeterli coin
            $u->save();
            $token = $u->createToken('e2e')->plainTextToken;
            $out[] = ['id' => $u->id, 'token' => $token, 'nick' => $nick];
        }

        $path = storage_path('app/e2e-users.json');
        file_put_contents($path, json_encode($out, JSON_PRETTY_PRINT));
        $this->info('E2E users -> '.$path.' (ids: '.$out[0]['id'].','.$out[1]['id'].')');

        return self::SUCCESS;
    }
}
