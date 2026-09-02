<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * contents.hotel — etkinligin yapildigi OTEL adi (Oteller listesinden secilir).
 * Otel kayitlari Content type='otel' olarak tutulur; resimleri oraya yuklenir.
 * Etkinlik sadece otel ADINI saklar; frontend bu ada gore otelin resmini/bilgisini gosterir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->string('hotel')->nullable()->after('place');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('hotel');
        });
    }
};
