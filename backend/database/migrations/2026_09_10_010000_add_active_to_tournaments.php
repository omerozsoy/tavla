<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            // Yayin durumu: aktif=sitede gorunur, pasif=silmeden gizlenir (yonetici anahtari).
            // status (open/running/finished) oyun yasam dongusudur; bu ondan bagimsizdir.
            $table->boolean('active')->default(true)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('active');
        });
    }
};
