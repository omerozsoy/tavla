<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mesaj istekleri: arkadas OLMAYAN biri mesaj attiginda, konusma aliciya
// "istek" olarak dusar. Alici kabul edene (ya da cevap yazana) kadar normal
// gelen kutusuna girmez. requester -> ilk mesaji atan, target -> alici.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete(); // ilk mesaji atan
            $table->foreignId('target_id')->constrained('users')->cascadeOnDelete();     // alici (istegi onaylayacak)
            $table->string('status')->default('pending'); // pending | accepted | declined
            $table->timestamps();
            $table->unique(['requester_id', 'target_id']);
            $table->index(['target_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_requests');
    }
};
