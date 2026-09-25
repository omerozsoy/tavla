<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Güvenlik Kalkanı canlı tablosunda "kim hangi sayfada" görebilmek için SPA'nın o an
// gösterdiği rota (istemci X-Page başlığıyla bildirir). API yolundan farklıdır.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('shield_presence', 'last_page')) {
            Schema::table('shield_presence', function (Blueprint $table): void {
                $table->string('last_page', 191)->nullable()->after('last_path');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('shield_presence', 'last_page')) {
            Schema::table('shield_presence', function (Blueprint $table): void {
                $table->dropColumn('last_page');
            });
        }
    }
};
