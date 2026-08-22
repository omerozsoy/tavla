<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->unsignedBigInteger('stake')->default(0)->after('status'); // bahis (coin); 0 = bahissiz
            $table->unsignedBigInteger('p1_user_id')->nullable()->after('p1_token');
            $table->unsignedBigInteger('p2_user_id')->nullable()->after('p2_token');
            $table->boolean('settled')->default(false)->after('stake'); // coin transferi yapildi mi
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['stake', 'p1_user_id', 'p2_user_id', 'settled']);
        });
    }
};
