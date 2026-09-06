<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

/**
 * Queue worker CANLILIK nabzı: services:watch dakikada bir dispatch eder; worker İŞLERSE cache'e
 * zaman damgası yazar. services:watch nabzın tazeliğine bakarak worker'ın (boştayken bile) ayakta
 * olup olmadığını anlar. Worker kapalıysa nabız bayatlar -> uyarı. Ucuz (tek cache yazımı).
 */
class QueueHeartbeatJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 15;

    public function handle(): void
    {
        Cache::put('queue:heartbeat', time(), now()->addHours(2));
    }
}
