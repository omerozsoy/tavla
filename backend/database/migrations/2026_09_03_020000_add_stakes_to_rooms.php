<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Tek Oyun: p1'in kabul ettigi COKLU bahis tutarlari (JSON dizi).
            // Eslesmede aday listesiyle KESISIM aranir; ortak tutarlardan en yuksegi anlasilir
            // ve 'stake' kolonuna yazilir (settle bunu kullanir). Bos/tek secim = eski davranis.
            $table->json('stakes')->nullable()->after('stake');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('stakes');
        });
    }
};
