<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            // Turnuvayi duzenleyen kurum (contents type='kurum'). Panelden secilir.
            $table->foreignId('organizer_id')->nullable()->after('venue');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('organizer_id');
        });
    }
};
