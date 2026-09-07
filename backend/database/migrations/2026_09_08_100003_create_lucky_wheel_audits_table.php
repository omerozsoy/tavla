<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Şans Çarkı ekonomik değer (coin/premium) dağıttığı için admin değişiklikleri
    // izlenebilir olmalı. Bu tablo yalnızca ödül/ayar değişikliklerini kaydeder.
    public function up(): void
    {
        Schema::create('lucky_wheel_audits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_id')->nullable();  // değişikliği yapan admin
            $table->string('admin_name')->nullable();
            $table->string('action', 40);                        // created|updated|deleted|toggled|reordered|settings
            $table->string('target', 60)->nullable();            // reward:<id> | settings
            $table->json('changes')->nullable();                 // {field: [old, new], ...}
            $table->timestamp('created_at')->nullable();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lucky_wheel_audits');
    }
};
