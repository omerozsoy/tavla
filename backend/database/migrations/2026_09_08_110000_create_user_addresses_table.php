<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kullanici adres defteri (Adreslerim). type: teslimat (shipping) veya fatura (billing).
// Sepet odemesinde secili adres siparise SNAPSHOT olarak yazilir (adres degisse gecmis bozulmaz).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10)->default('shipping'); // shipping | billing
            $table->string('title', 60)->nullable();          // "Ev", "İş" vb.
            $table->string('name');                           // alici / fatura adi
            $table->string('phone', 40);
            $table->text('address');
            $table->string('city', 80);
            $table->string('district', 80)->nullable();       // ilce
            $table->string('postal', 20)->nullable();
            $table->boolean('is_default')->default(false);    // tipi icinde varsayilan
            // Fatura alanlari (yalnizca type=billing)
            $table->string('company', 160)->nullable();       // firma unvani (kurumsal)
            $table->string('tax_office', 120)->nullable();    // vergi dairesi
            $table->string('tax_number', 40)->nullable();     // vergi no / TCKN
            $table->timestamps();

            $table->index(['user_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_addresses');
    }
};
