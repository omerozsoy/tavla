<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ana sayfada paneller arasina yerlestirilen yatay reklam seritleri.
// 3 slot: top (banner alti), middle (takvim/turnuva blogu alti), bottom (footer ustu).
// Her reklam masaustu + (opsiyonel) mobil gorsel + hedef link tutar; panelden yonetilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ad_slots', function (Blueprint $table) {
            $table->id();
            $table->string('slot', 20)->index(); // top | middle | bottom
            $table->string('image', 500)->nullable();        // masaustu gorsel (1120x180)
            $table->string('image_mobile', 500)->nullable(); // mobil gorsel (720x300) — opsiyonel
            $table->string('link', 500)->nullable();         // tiklaninca gidilecek URL — opsiyonel
            $table->unsignedInteger('sort')->default(0);     // ayni slotta kucuk sayi once
            $table->boolean('published')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_slots');
    }
};
