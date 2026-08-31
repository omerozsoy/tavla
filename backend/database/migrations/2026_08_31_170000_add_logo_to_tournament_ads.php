<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner sol panelinde gosterilen "duzenleyen" logosu (opsiyonel). Baslik ustunde
// kucuk gosterilir; bos ise hic cikmaz. public/uploads/banner/logo altina yuklenir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->string('logo')->nullable()->after('image');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->dropColumn('logo');
        });
    }
};
