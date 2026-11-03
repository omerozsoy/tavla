<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 3 Haklı Swiss'te hak sayısı artık turnuva bazında seçilebilir (1/2/3). Başlangıçta swiss_state
// config'ine kilitlenir. Diğer tipler (bracket) bu sütunu yok sayar. Varsayılan 3 = eski davranış.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'swiss_lives')) {
                $t->unsignedTinyInteger('swiss_lives')->default(3)->after('swiss_state');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'swiss_lives')) {
                $t->dropColumn('swiss_lives');
            }
        });
    }
};
