<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Bilgi sayfasi "ust baslik": hangi footer kolonu veya sol-menu grubu altinda gorunecek.
// Deger "footer:<kolon>" veya "menu:<grup>" (or. footer:game, menu:play). Bos -> hicbir
// yerde listelenmez (yalniz /bilgi/<slug> dogrudan URL). Frontend bunu footer/menu'ye enjekte eder.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('info_pages', function (Blueprint $table) {
            $table->string('section')->nullable()->after('sort');
        });
    }

    public function down(): void
    {
        Schema::table('info_pages', function (Blueprint $table) {
            $table->dropColumn('section');
        });
    }
};
