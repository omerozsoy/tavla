<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin "Tavla Tasarımı": yerleşik tahtaların grup/fiyat/satış ayarı + admin'in ürettiği özel tahtalar.
// Yerleşikler (is_custom=false) database/data/board_themes.json'dan senkronlanır (BoardDesign::syncBuiltins).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('board_designs', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 34)->unique(); // unlock id: 'theme.<slug>' (buy() max:40)
            $table->string('name', 60);
            $table->string('group', 16); // common|rare|epic|legendary|mythic|club|country|tavlatv
            $table->unsignedInteger('price')->nullable(); // null -> grup fiyatı
            $table->boolean('is_custom')->default(false);
            $table->json('colors'); // panel, frame, a, b, checker, light
            $table->string('surface', 16)->nullable();
            $table->string('checker_style', 16)->nullable();
            $table->boolean('active')->default(true); // satışta mı (sahip olanlar kullanmaya devam eder)
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });
        \App\Models\BoardDesign::syncBuiltins();
    }

    public function down(): void
    {
        Schema::dropIfExists('board_designs');
    }
};
