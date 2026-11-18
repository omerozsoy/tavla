<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

// Açılış pratiği havuzunu deploy'da otomatik doldur (openings:import, CSV.gz otoritedir).
// Migration'da çalışır -> Forge deploy `migrate --force` ile prod'a SSH'sız yüklenir. Idempotent
// (komut truncate+insert); veriyi güncellersen `php artisan openings:import` elle yeniden koşar.
return new class extends Migration
{
    public function up(): void
    {
        // Testte her RefreshDatabase'de 84k insert = CI ölümü -> atla. Test kendi import'unu çağırır.
        if (app()->environment('testing')) {
            return;
        }
        Artisan::call('openings:import');
    }

    public function down(): void
    {
        //
    }
};
