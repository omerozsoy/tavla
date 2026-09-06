<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Site ayarları (yönetim panelinden düzenlenir): ekonomi değerleri (başlangıç rating, hoşgeldin
 * coin, 6 saatlik ödül normal/premium, komisyon %). Key-value; kod Setting::int(...) ile okur,
 * kayıt yoksa varsayılana düşer. Admin panel > Site Ayarları'ndan güncellenir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 60)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
