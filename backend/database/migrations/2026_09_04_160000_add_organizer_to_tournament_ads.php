<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner'a "Düzenleyen kurum" (Content type='kurum') secimi eklenir. Secilirse
// sol paneldeki logo, elle yuklenen logo yerine kurumun logosundan cikar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table): void {
            $table->unsignedBigInteger('organizer_id')->nullable()->after('tournament_id');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table): void {
            $table->dropColumn('organizer_id');
        });
    }
};
