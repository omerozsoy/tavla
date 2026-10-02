<?php

namespace App\Console\Commands;

use App\Http\Controllers\TournamentController;
use Illuminate\Console\Command;

/**
 * TURNUVA BAKIM NABZI (cron): süren turnuvalarda hükmen/no-show/ölü-dal/sonuç-uzlaştırmayı
 * HTTP poll'una (GET /tournaments) bağlı KALMADAN dakikada bir çalıştırır.
 *
 * KÖK NEDEN: resolveStalledMatches / reconcileVerifiedResults yalnız TournamentController@index|show
 * içinden (autoStartDue) tetikleniyordu. İki oyuncu da sekmeyi kapatıp kimse /tournaments'ı
 * poll etmezse stall eden maç (rakip gelmedi / yarım kaldı) sonsuza dek "kazanansız" takılıyordu.
 * Bu komut o kör noktayı kapatır: tahtadaki 60sn no-show istemci çağrısının yedeği.
 *
 * Idempotent: değişiklik yoksa maliyetsiz (transient DB kilidinde sessizce geçer, controller yutar).
 */
class TournamentTick extends Command
{
    protected $signature = 'tournaments:tick';

    protected $description = 'Süren turnuvalarda hükmen/no-show/ölü-dal çözümünü cron ile tetikler (HTTP poll yedeği).';

    public function handle(TournamentController $tournaments): int
    {
        $tournaments->runScheduledMaintenance();

        return self::SUCCESS;
    }
}
