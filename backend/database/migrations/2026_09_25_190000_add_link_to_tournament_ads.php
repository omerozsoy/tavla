<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner'a serbest "hedef link" eklenir. Doluysa banner tiklaninca bagli turnuva
// yerine bu URL'e gidilir (dis site yeni sekmede, ic yol ayni sekmede). Bu sayede
// banner bir turnuvaya baglanmadan da (yalnizca link ile) yayinlanabilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table): void {
            $table->string('link', 500)->nullable()->after('tournament_id');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table): void {
            $table->dropColumn('link');
        });
    }
};
