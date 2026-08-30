<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Otomatik yenileme acik mi (kullanici kapatabilir -> plan_until'da biter)
            $table->boolean('auto_renew')->default(true)->after('trial_used');
            // Uye olma tarihi: ilk basarili odeme/deneme (yenilemede DEGISMEZ)
            $table->timestamp('plan_since')->nullable()->after('plan_until');
        });

        // Mevcut ucretli uyeler: plan_since = en erken 'paid' odeme tarihi (varsa).
        // Not: alias'siz yazildi -> sqlite (test) + MySQL (prod) ikisinde de calisir.
        // (sqlite "UPDATE users u SET ..." alias sozdizimini kabul etmez.)
        DB::statement(
            "UPDATE users SET plan_since = (
                SELECT MIN(p.created_at) FROM payments p
                WHERE p.user_id = users.id AND p.status = 'paid'
            ) WHERE plan <> 'free' AND plan_since IS NULL"
        );
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['auto_renew', 'plan_since']);
        });
    }
};
