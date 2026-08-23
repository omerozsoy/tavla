<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Uyelik plani: free | star | starpro. plan_until = bitis (deneme/abonelik).
            $table->string('plan', 16)->default('free')->after('badges');
            $table->timestamp('plan_until')->nullable()->after('plan');
            $table->boolean('trial_used')->default(false)->after('plan_until'); // 7 gun deneme bir kez
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['plan', 'plan_until', 'trial_used']);
        });
    }
};
