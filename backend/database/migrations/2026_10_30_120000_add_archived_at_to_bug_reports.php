<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Hata bildirimlerini arşivleme: arşivlenen kayıtlar varsayılan listede görünmez,
// "Arşivlenenler" filtresiyle okunabilir. Silme değil -> kayıt korunur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};
