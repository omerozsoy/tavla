<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_commands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->uuid('command_id');
            $table->string('action', 32);
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->string('actor_slot', 2)->nullable();
            $table->string('payload_hash', 64);
            $table->unsignedBigInteger('expected_version')->nullable();
            $table->unsignedBigInteger('result_version')->nullable();
            $table->timestamps();
            $table->unique(['room_id', 'command_id']);
            $table->index(['room_id', 'action']);
            $table->index('actor_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_commands');
    }
};
