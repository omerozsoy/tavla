<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Sol menu grubunun BASLANGIC durumu (admin-yonetimli): collapsed=true ise grup katli baslar.
// Kullanicinin kendi tiklamasi (localStorage) yine bunun uzerine yazar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_groups', function (Blueprint $table) {
            $table->boolean('collapsed')->default(false)->after('visible');
        });
        // Mevcut kurulumlarda ilk iki grup (play/compete) acik, gerisi kapali -> onceki
        // frontend davranisini KORU.
        DB::table('menu_groups')->whereNotIn('key', ['play', 'compete'])->update(['collapsed' => true]);
    }

    public function down(): void
    {
        Schema::table('menu_groups', function (Blueprint $table) {
            $table->dropColumn('collapsed');
        });
    }
};
