<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin "Avatar Tasarımı" / "Pul Tasarımı": avatar çerçevesi + pul tasarımı grup/fiyat/satış ayarı.
// Satırlar database/data/cosmetics.json'dan senkronlanır (CosmeticItem::syncCatalog).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cosmetic_items', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 16); // frame | checker
            $table->string('item_id', 40);
            $table->string('name', 60);
            $table->string('group', 16); // common|rare|epic|legendary|mythic
            $table->unsignedInteger('price')->nullable(); // null -> grup fiyatı
            $table->boolean('active')->default(true);
            $table->json('meta')->nullable(); // önizleme renkleri
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['kind', 'item_id']);
        });
        \App\Models\CosmeticItem::syncCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('cosmetic_items');
    }
};
