<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sol menüye ADMIN-EKLEMELİ "özel menü öğesi" desteği: href (hedef URL/rota) + custom bayrağı.
 * Katalog (pages.ts/config/menu.php) öğeleri custom=false kalır; syncCatalog custom satırlara
 * DOKUNMAZ (yalnız eksik katalog anahtarı ekler, hiç silmez).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('menu_items')) {
            return;
        }
        Schema::table('menu_items', function (Blueprint $table) {
            if (! Schema::hasColumn('menu_items', 'href')) {
                $table->string('href')->nullable()->after('group'); // özel öğe hedefi (/rota veya https://...)
            }
            if (! Schema::hasColumn('menu_items', 'custom')) {
                $table->boolean('custom')->default(false)->after('href'); // admin-eklemeli mi
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('menu_items')) {
            return;
        }
        Schema::table('menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('menu_items', 'href')) {
                $table->dropColumn('href');
            }
            if (Schema::hasColumn('menu_items', 'custom')) {
                $table->dropColumn('custom');
            }
        });
    }
};
