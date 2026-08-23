<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('order_id', 64)->unique();     // Garanti'ye giden benzersiz siparis no
            $table->string('plan', 16);                    // star | starpro
            $table->string('period', 8);                   // yearly | monthly
            $table->unsignedInteger('amount');             // kurus (TRY minor units)
            $table->string('currency', 4)->default('949'); // 949 = TRY
            $table->string('status', 16)->default('pending'); // pending | paid | failed
            $table->text('bank_msg')->nullable();          // banka yaniti (hata/aciklama)
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
