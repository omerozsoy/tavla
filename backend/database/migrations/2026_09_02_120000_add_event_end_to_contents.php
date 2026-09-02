<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * contents.event_end — etkinlik BITIS tarihi (cok gunlu turnuvalar icin).
 * event_at = baslangic. Takvim event_at..event_end araligini isaretler (metin parse yerine).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->timestamp('event_end')->nullable()->after('event_at');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('event_end');
        });
    }
};
