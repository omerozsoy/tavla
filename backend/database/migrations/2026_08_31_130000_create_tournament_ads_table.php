<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ana sayfanin en ustunde yan yana gosterilen turnuva reklam gorselleri.
// Her reklam bir turnuvaya baglanir; tiklaninca o turnuvanin detayina gidilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_ads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->nullable()
                ->constrained('tournaments')->nullOnDelete();
            $table->string('image', 500)->nullable(); // panelden yuklenen gorsel (uploads diski)
            $table->unsignedInteger('sort')->default(0); // kucuk sayi solda
            $table->boolean('published')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_ads');
    }
};
