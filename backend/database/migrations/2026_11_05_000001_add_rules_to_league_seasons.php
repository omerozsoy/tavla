<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** §16 Kurallar sekmesi: admin panelden düzenlenebilir metin. Boşsa frontend i18n varsayılanı gösterir. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('league_seasons', function (Blueprint $t): void {
            $t->text('rules')->nullable()->after('prizes');
        });
    }

    public function down(): void
    {
        Schema::table('league_seasons', function (Blueprint $t): void {
            $t->dropColumn('rules');
        });
    }
};
