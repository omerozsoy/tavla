<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dice_slot_spins', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->json('reels');                               // ['d3','d3','d3'] — kazanıldığı andaki 3 sembol
            $table->string('win_type', 16)->default('none');     // none | triple | jackpot
            $table->unsignedInteger('payout')->default(0);       // kazanılan coin (jackpot dahil)
            $table->unsignedInteger('cost')->default(0);         // ödemeli çevirmede harcanan coin (ücretsiz/bonus = 0)
            $table->string('spin_type', 16)->default('free');    // free | bonus | paid
            $table->boolean('jackpot_won')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['win_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dice_slot_spins');
    }
};
