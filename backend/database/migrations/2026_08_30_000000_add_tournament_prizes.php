<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            // Siralamaya gore odul tablosu: [{coins, desc}] — index 0 = 1.lik, 1 = 2.lik ...
            // Kac kisiye odul verilecegi = dizi uzunlugu; her sira icin ayri coin+aciklama.
            $table->json('prizes')->nullable()->after('prize_desc');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('prizes');
        });
    }
};
