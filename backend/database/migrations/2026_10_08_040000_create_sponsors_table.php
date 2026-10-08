<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sponsorlar — ana sayfa footer'ındaki karusel şeridi. Her sponsor bir LOGO + kısa AD tutar
 * (opsiyonel link). Panelden ("Sponsorlar") eklenir/sıralanır. /api/footer-config ile okunur,
 * App.tsx Footer'a geçer. AdSlot ile aynı upload deseni (disk 'uploads').
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sponsors')) {
            Schema::create('sponsors', function (Blueprint $table) {
                $table->id();
                $table->string('name', 80);              // kısa ad (logo altında gösterilir)
                $table->string('logo');                  // yüklenen logo yolu (uploads/sponsor)
                $table->string('link', 500)->nullable(); // opsiyonel hedef (dış adres)
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('visible')->default(true);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sponsors');
    }
};
