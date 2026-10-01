<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// GEÇİCİ ÖLÇÜM: Safari "sayfa çok yenileniyor" şikâyetinin kökünü (durum1 autoUpdate vs
// durum2 Safari bellek-öldürme) canlı veriyle ayırmak için. İstemci (reloadDiag.ts) yalnız
// GERÇEK bir yenilenmede bir satır yazar. Panelde ReloadDiagStats widget'ı özetler.
// Ölçüm bitince: tablo + route + widget + reloadDiag.ts silinir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reload_diags', function (Blueprint $table) {
            $table->id();
            $table->string('cause', 24)->index();   // autoupdate | native | ptr | chunk | error-button | gate | consent
            $table->string('nav', 24)->nullable();   // reload | navigate | back_forward | ...
            $table->string('prev_view', 12)->nullable(); // game | other | unknown (yenilenme öncesi ekran)
            $table->integer('hidden_for_ms')->nullable(); // gizlendikten bu boot'a kadar geçen süre
            $table->string('ua', 300)->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reload_diags');
    }
};
