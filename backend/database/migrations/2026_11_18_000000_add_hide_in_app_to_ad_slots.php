<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Reklam seridi mobil UYGULAMADA (Capacitor APK WebView) gizlensin mi? Web/masaustu etkilenmez.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ad_slots', function (Blueprint $table) {
            $table->boolean('hide_in_app')->default(false)->after('published');
        });
    }

    public function down(): void
    {
        Schema::table('ad_slots', function (Blueprint $table) {
            $table->dropColumn('hide_in_app');
        });
    }
};
