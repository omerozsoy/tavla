<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blunders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('loss', 6, 4);   // kaybedilen equity
            $table->string('played', 32);     // oynanan hamle notasyonu
            $table->string('best', 32);       // en iyi hamle notasyonu
            $table->timestamps();
            $table->index(['user_id', 'loss']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blunders');
    }
};
