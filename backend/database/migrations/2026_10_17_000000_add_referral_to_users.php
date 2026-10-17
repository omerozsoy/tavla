<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Arkadaş davet (referral) sistemi. "Davet et, 5000 coin kazan": davet eden kullanıcının
 * stabil referral_code'u olur; davet edilen kayıtta referred_by işlenir; davet edilen İLK
 * PUANLI ONLINE İNSAN maçını yapınca her iki tarafa ödül verilir (referral_rewarded_at ile
 * bir kez). referral_count = o kullanıcının ödül kazandıran başarılı davet sayısı (UI).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('referral_code', 12)->nullable()->unique();
            $table->unsignedBigInteger('referred_by')->nullable()->index();
            $table->timestamp('referral_rewarded_at')->nullable();
            $table->unsignedInteger('referral_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['referral_code', 'referred_by', 'referral_rewarded_at', 'referral_count']);
        });
    }
};
