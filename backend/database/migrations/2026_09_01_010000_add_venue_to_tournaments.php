<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            // Duzenlenme yeri / otel adi (fiziksel mekan). Ornek: "Titanic Otel, Antalya"
            $table->string('venue')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('venue');
        });
    }
};
