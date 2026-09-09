<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dice_slot_user_states', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->unsignedInteger('daily_free_spins_used')->default(0); // reset_date içindeki kullanılan ücretsiz hak
            $table->unsignedInteger('bonus_spins')->default(0);           // admin / kampanya ile verilen ekstra hak
            $table->timestamp('last_spin_at')->nullable();
            $table->date('reset_date')->nullable();                       // daily_free_spins_used'in ait olduğu gün
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dice_slot_user_states');
    }
};
