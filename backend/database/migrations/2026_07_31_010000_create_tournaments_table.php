<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournaments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedTinyInteger('size')->default(8); // 4 | 8 | 16
            $table->string('status')->default('open');       // open | running | finished
            $table->foreignId('creator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('players')->nullable();  // [{id,name,rating,avatar}]
            $table->json('bracket')->nullable();  // [[{key,p1,p2,winner}],...]  round -> maclar
            $table->unsignedInteger('champion_id')->nullable();
            $table->timestamps();
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournaments');
    }
};
