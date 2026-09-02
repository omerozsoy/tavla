<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * contents.country — etkinlik/otel ULKESI. Iki deger: 'Türkiye' | 'KKTC' (Kuzey Kibris).
 * Il (province) secimi ulkeye gore degisir: Turkiye 81 il, KKTC 6 il.
 * Mevcut kayitlar Turkiye kabul edilir (backfill).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->string('country')->nullable()->after('province');
        });
        // Mevcut il'i olan kayitlar (etkinlik/otel/kulup) Turkiye'dir.
        \DB::table('contents')->whereNotNull('province')->where('province', '!=', '')
            ->update(['country' => 'Türkiye']);
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('country');
        });
    }
};
