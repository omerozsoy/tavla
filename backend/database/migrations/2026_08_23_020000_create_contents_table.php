<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contents', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16);        // service | blog | event | club
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('organizer')->nullable(); // etkinlik: duzenleyen/otel
            $table->string('place')->nullable();      // etkinlik: yer; kulup: adres
            $table->string('province')->nullable();   // kulup: il
            $table->string('contact')->nullable();    // iletisim
            $table->string('image')->nullable();
            $table->timestamp('event_at')->nullable(); // etkinlik tarihi/saati; blog: yayin
            $table->integer('sort')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
            $table->index(['type', 'event_at']);
            $table->index(['type', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contents');
    }
};
