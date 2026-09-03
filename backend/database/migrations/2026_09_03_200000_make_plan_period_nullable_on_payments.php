<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * payments.plan ve payments.period baslangicta uyelik icin NOT NULL olusturulmustu.
 * Coin (jeton) satin alimlarinda bu alanlar bos oldugundan (kind='coins') strict MySQL
 * "Field 'plan' doesn't have a default value" (1364) hatasi veriyordu. Nullable yapiliyor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('plan', 16)->nullable()->change();
            $table->string('period', 8)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('plan', 16)->nullable(false)->change();
            $table->string('period', 8)->nullable(false)->change();
        });
    }
};
