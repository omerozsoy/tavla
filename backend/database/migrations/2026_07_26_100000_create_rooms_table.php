<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 8)->unique();       // paylasilan oda kodu
            $table->string('p1_token', 64);            // olusturan oyuncunun istemci token'i
            $table->string('p1_name', 40);
            $table->string('p2_token', 64)->nullable(); // katilan oyuncu
            $table->string('p2_name', 40)->nullable();
            $table->json('state')->nullable();          // tam oyun durumu (snapshot)
            $table->unsignedInteger('version')->default(0); // her guncellemede artar (polling)
            $table->string('status', 16)->default('waiting'); // waiting | playing | finished
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
