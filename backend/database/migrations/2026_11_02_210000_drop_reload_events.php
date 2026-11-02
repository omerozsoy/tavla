<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// GEÇİCİ TANI tablosu kaldırıldı: "maç içinde kendi kendine F5" analizi tamamlandı; reload beacon
// (/diag/reload route + src/reloadDiag.ts) silindi. Bu tablo artık yazılmıyor -> düşürülür.
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('reload_events');
    }

    public function down(): void
    {
        // Geri alma: orijinal yapıyı yeniden kur (veri geri gelmez; tablo tanı amaçlıydı).
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
};
