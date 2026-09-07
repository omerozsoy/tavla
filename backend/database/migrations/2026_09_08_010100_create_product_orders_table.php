<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fiziksel urun siparisleri. Tek urun + adet + secili renk (gorsel) tek satir.
// Odeme: coin -> aninda 'paid' (atomik stok+coin dusumu); money -> 'pending', Garanti
// odemesi basarili olunca callback/demo 'paid' yapar (bkz payments.product_order_id).
// Urun adi/fiyati SNAPSHOT (urun silinse/degisse de siparis bozulmaz). Kargo adresi + admin
// takip no + durum akisi: pending -> paid -> shipped -> delivered (veya cancelled).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');                  // snapshot
            $table->string('color')->nullable();             // secili renk adi (gorsel)
            $table->unsignedInteger('qty')->default(1);
            $table->string('payment_type', 10);              // coin | money
            $table->unsignedInteger('coin_cost')->nullable(); // toplam jeton (coin)
            $table->unsignedInteger('amount')->nullable();    // toplam KURUS (money)
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('pending'); // pending|paid|shipped|delivered|cancelled
            // Kargo adresi
            $table->string('ship_name');
            $table->string('ship_phone', 40);
            $table->text('ship_address');
            $table->string('ship_city', 80);
            $table->string('ship_postal', 20)->nullable();
            $table->text('note')->nullable();                // alici notu
            $table->string('tracking')->nullable();          // kargo takip no (admin)
            $table->text('admin_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_orders');
    }
};
