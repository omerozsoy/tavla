<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kullanıcının cihazdan-bağımsız tercihleri (tahta, tema, ses, dil, animasyon...).
// Tek JSON kolon: {"tavla.board":"galaxy","tavla.theme":"dark",...}. Eskiden yalnız
// localStorage'daydı -> web ve app ayrı görünüyordu; artık hesaba bağlı (web↔app senkron).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'prefs')) {
                $table->json('prefs')->nullable()->after('unlocks');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'prefs')) {
                $table->dropColumn('prefs');
            }
        });
    }
};
