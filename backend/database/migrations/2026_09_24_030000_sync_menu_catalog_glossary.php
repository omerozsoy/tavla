<?php

use App\Models\MenuItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * config/menu.php katalogundaki eksik menu_items satirlarini (ozellikle yeni 'info-glossary'
 * = Bilgi › Sözlük) deploy aninda ekler. syncCatalog idempotenttir: mevcut satirlarin
 * sira/ad/gorunurlugunu KORUR, yalnizca eksik anahtarlari sona ekler.
 *
 * NOT: syncCatalog admin "Sol Menu" sayfasi acilinca da calisir; bu migration yalnizca
 * satirin admin ziyaretini beklemeden hazir olmasini garantiler.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('menu_items')) {
            MenuItem::syncCatalog();
        }
    }

    public function down(): void
    {
        // Geri alma: yalnizca bu migration'in ekleyebilecegi anahtari kaldir (guvenli).
        if (Schema::hasTable('menu_items')) {
            MenuItem::where('key', 'info-glossary')->delete();
        }
    }
};
