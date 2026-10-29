<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// GEÇİCİ TANI: "maç içinde kendi kendine F5" şikayetinin GERÇEK nedenini toplamak için reload
// olaylarını kaydeder (reason=chunk/selfheal/browser/update/ptr/eb-manual, in_match, mobil, yol).
// Beacon ile best-effort yazılır. Turnuva/analiz sonrası tablo düşürülebilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reload_events', function (Blueprint $table) {
            $table->id();
            $table->string('reason', 40)->index();
            $table->boolean('in_match')->default(false)->index();
            $table->boolean('is_mobile')->default(false);
            $table->string('nav_type', 20)->nullable();
            $table->string('path', 160)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reload_events');
    }
};
