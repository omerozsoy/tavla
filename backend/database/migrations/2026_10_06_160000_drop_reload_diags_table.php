<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

// GEÇİCİ ölçüm bitti (Safari "çok yenileniyor" -> çoğu native tab-discard). reload_diags tablosu +
// route + widget + src/reloadDiag.ts kaldırıldı; canlı DB'den tabloyu da düşür.
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('reload_diags');
    }

    public function down(): void
    {
        // Ölçüm aracı kaldırıldı; geri alma yok (tabloyu yeniden kurma).
    }
};
