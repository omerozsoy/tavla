<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A-31: PromoCode::usable checkout'ta (lockForUpdate altında) payments'ı discount_code+status+created_at
// ile sayar; indeks yoktu -> tablo taraması kilit süresini uzatıyordu.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('payments', 'discount_code')) {
            return;
        }
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['discount_code', 'status', 'created_at'], 'payments_promo_usage_idx');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('payments', 'discount_code')) {
            return;
        }
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_promo_usage_idx');
        });
    }
};
