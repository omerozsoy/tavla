<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TUM kullanicilarin jeton (coin) bakiyesini sabit bir degere sifirlar (varsayilan 1000).
 * Ayrica rezerve (escrow) jetonlari 0'a ceker; boylece bahisli maclardan kalan kilitli
 * bakiye kalmaz ve kullanilabilir bakiye = coins olur.
 *
 * GERI ALINAMAZ. Once DB yedegi al (Plesk > Veritabanlari > Disa Aktar veya mysqldump).
 */
class ResetCoins extends Command
{
    protected $signature = 'tavla:reset-coins {--amount=1000 : Herkese verilecek jeton miktari} {--force : Onay sormadan calistir}';

    protected $description = 'TUM kullanicilarin jetonunu sabit degere (varsayilan 1000) sifirlar ve rezerve jetonlari temizler.';

    public function handle(): int
    {
        $amount = (int) $this->option('amount');
        if ($amount < 0) {
            $this->error('Miktar negatif olamaz.');

            return self::FAILURE;
        }

        $total = DB::table('users')->count();
        $this->warn('GERI ALINAMAZ. '.$total.' kullanicinin jetonu '.$amount.' olacak, rezerve jetonlar temizlenecek.');
        if (! $this->option('force') && ! $this->confirm('Devam edilsin mi?')) {
            $this->info('Iptal edildi.');

            return self::SUCCESS;
        }

        $count = 0;
        User::query()->select(['id', 'coins', 'coins_reserved'])->chunkById(100, function ($users) use ($amount, &$count) {
            foreach ($users as $user) {
                DB::transaction(function () use ($user, $amount, &$count) {
                    $locked = User::lockForUpdate()->findOrFail($user->id);
                    if (Schema::hasColumn('users', 'coins_reserved')) {
                        $locked->coins_reserved = 0;
                        $locked->save();
                    }
                    app(WalletService::class)->setBalance($locked, $amount, 'admin_reset_coins');
                    $count++;
                });
            }
        });
        $this->info('Bitti. '.$count.' kullanicinin jetonu '.$amount.' olarak ayarlandi.');

        return self::SUCCESS;
    }
}
