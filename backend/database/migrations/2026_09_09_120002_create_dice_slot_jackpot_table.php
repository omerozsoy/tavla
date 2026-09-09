<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Artan (progressive) jackpot havuzu — TEK satır (id=1). Her spinde havuz büyür
     * (jackpot_increment); biri 64-64-64 yapınca havuzu kazanır ve pool tabana sıfırlanır.
     * Atomiklik: spin transaction'ında lockForUpdate ile kilitlenir.
     */
    public function up(): void
    {
        Schema::create('dice_slot_jackpot', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('pool')->default(0);              // güncel havuz (coin)
            $table->unsignedBigInteger('total_contributed')->default(0); // ömür boyu toplam katkı (istatistik)
            $table->unsignedBigInteger('last_won_user_id')->nullable();
            $table->unsignedInteger('last_won_amount')->nullable();
            $table->timestamp('last_won_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dice_slot_jackpot');
    }
};
