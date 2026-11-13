<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SWISS BYE/KURA ŞEKLİ: false = elle çekilir (admin/varsayılan), true = sistem otomatik çeker.
// Dernek/grup "Canlı Turnuva Sistemi" formunda Swiss seçilince sorulur. Bracket yok sayar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            $t->boolean('swiss_auto_draw')->default(false)->after('swiss_lives');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            $t->dropColumn('swiss_auto_draw');
        });
    }
};
