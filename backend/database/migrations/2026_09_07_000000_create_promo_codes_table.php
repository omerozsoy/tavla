<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Indirim (promo) kodlari: coin sepeti odemesinde SUNUCU-OTORITER indirim.
// Kod client'ta degil, odeme olusturulurken backend'de dogrulanip tutara uygulanir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promo_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();          // BUYUK harf normalize saklanir
            $table->string('type', 10)->default('percent'); // 'percent' | 'fixed'
            $table->unsignedInteger('value')->default(0);    // percent: 1-100 · fixed: KURUS
            $table->unsignedInteger('min_amount')->default(0); // asgari sepet (kurus); altinda gecersiz
            $table->unsignedInteger('max_uses')->nullable();   // null = sinirsiz
            $table->unsignedInteger('used_count')->default(0); // BASARILI kullanim sayaci
            $table->boolean('active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::table('payments', function (Blueprint $table) {
            // Uygulanan indirim kodu + indirim tutari (kurus). amount ZATEN indirimli saklanir.
            $table->string('discount_code', 40)->nullable()->after('package_id');
            $table->unsignedInteger('discount_kurus')->default(0)->after('discount_code');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['discount_code', 'discount_kurus']);
        });
        Schema::dropIfExists('promo_codes');
    }
};
