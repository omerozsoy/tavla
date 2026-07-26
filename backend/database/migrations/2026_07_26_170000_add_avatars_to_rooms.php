<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->longText('p1_avatar')->nullable()->after('p1_rating');
            $table->longText('p2_avatar')->nullable()->after('p2_rating');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['p1_avatar', 'p2_avatar']);
        });
    }
};
