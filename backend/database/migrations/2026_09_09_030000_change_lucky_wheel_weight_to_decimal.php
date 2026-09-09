<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Şans Çarkı ödül ağırlığı (weight) artık ONDALIK olabilir (örn. 0.5).
 * Tam sayı (unsignedInteger) -> decimal(10,2). Kazanan seçimi weightedPick'te
 * 100 ile ölçeklenip random_int (CSPRNG) ile yapılır; hassasiyet 2 ondalık.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lucky_wheel_rewards', function (Blueprint $table) {
            $table->decimal('weight', 10, 2)->default(1)->change();
        });
    }

    public function down(): void
    {
        Schema::table('lucky_wheel_rewards', function (Blueprint $table) {
            $table->unsignedInteger('weight')->default(1)->change();
        });
    }
};
