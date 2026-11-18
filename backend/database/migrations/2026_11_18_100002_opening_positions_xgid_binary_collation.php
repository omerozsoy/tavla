<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

// XGID büyük/küçük harf DUYARLI (E=üst oyuncunun taşı, e=alt oyuncunun) — varsayılan utf8mb4_unicode_ci
// collation xgid UNIQUE index'ini harf-duyarsız yapıyordu: yalnız case'de farklı 1155 GERÇEK pozisyon
// çakışıp yükleme sırasında düşüyordu (insertOrIgnore belirtiyi örttü, kökü DEĞİL). xgid'i utf8mb4_bin
// yap -> 84282'nin tamamı sığar; sonra havuzu yeniden yükle. MySQL'e özel (sqlite/test zaten case-sensitive).
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement('ALTER TABLE opening_positions MODIFY xgid VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
        Artisan::call('openings:import'); // binary collation ile artık 84282'nin tamamı yüklenir
    }

    public function down(): void
    {
        //
    }
};
