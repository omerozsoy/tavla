<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Oyuncu DURUMU (kendi belirledigi): available (Musait) | ready (Oyuna Hazir) |
// busy (Oyun Kabul Etmiyor) | offline (Cevrimdisi Gorun). Cevrimici listesinde
// gorunurlugu + davet kabulu bu alana bakar. Varsayilan 'available'.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('presence_status', 16)->default('available');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('presence_status');
        });
    }
};
