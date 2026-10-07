<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Özel menü öğesine admin-seçmeli ikon (frontend IconName). Boş -> slug'tan türetilen
 * eski davranış (pages.ts ikonu / arrow-right).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('menu_items')) {
            return;
        }
        Schema::table('menu_items', function (Blueprint $table) {
            if (! Schema::hasColumn('menu_items', 'icon')) {
                $table->string('icon')->nullable()->after('custom'); // frontend IconName (bos -> slug'tan turetilir)
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('menu_items')) {
            return;
        }
        Schema::table('menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('menu_items', 'icon')) {
                $table->dropColumn('icon');
            }
        });
    }
};
