<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * payments tablosuna coin (jeton) satin alma destegi.
 * kind: 'subscription' (uyelik) | 'coins' (jeton paketi).
 * coins: satin alinan toplam jeton (kind=coins). package_id: sepet ozeti (ilk/tekil paket id).
 * Mevcut kayitlar uyeliktir (default 'subscription').
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('kind')->default('subscription')->after('user_id');
            $table->unsignedInteger('coins')->nullable()->after('amount');
            $table->string('package_id')->nullable()->after('coins');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['kind', 'coins', 'package_id']);
        });
    }
};
