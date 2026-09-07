<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lucky_wheel_spins', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('reward_id')->nullable(); // ödül sonradan silinebilir -> nullable
            $table->json('reward_snapshot');                     // kazanıldığı andaki ödül (name/type/amount...) — geçmiş korunur
            $table->string('spin_type', 20)->default('free');    // free | bonus | admin
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['reward_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lucky_wheel_spins');
    }
};
