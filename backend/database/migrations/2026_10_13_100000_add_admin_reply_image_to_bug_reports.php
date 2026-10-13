<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Hata bildirimi YANITINA görsel: yönetici bildirene cevap verirken ekran görüntüsü/çizim
// ekleyebilsin. uploads diskinde (bug-replies/) tutulur; DB'de yalnız yol. (screenshot gibi)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            if (! Schema::hasColumn('bug_reports', 'admin_reply_image')) {
                $table->string('admin_reply_image')->nullable()->after('admin_reply');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            $table->dropColumn('admin_reply_image');
        });
    }
};
