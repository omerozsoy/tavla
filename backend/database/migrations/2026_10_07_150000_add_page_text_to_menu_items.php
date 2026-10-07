<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sol Menü öğesine OPSİYONEL sayfa metni (başlık + açıklama) override'ı: ör. "Tek Oyun" kurulum
// sayfasının başlığı/açıklaması panelden düzenlenebilsin. label_* deseniyle birebir: admin TR girer,
// MenuItem::booted() EN/ES/DE/FR'yi otomatik çevirir; boşsa hepsi null -> frontend i18n varsayılanı.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $t) {
            foreach (['tr', 'en', 'es', 'de', 'fr'] as $l) {
                if (! Schema::hasColumn('menu_items', 'title_'.$l)) {
                    $t->string('title_'.$l, 120)->nullable();
                }
                if (! Schema::hasColumn('menu_items', 'sub_'.$l)) {
                    $t->text('sub_'.$l)->nullable();
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $t) {
            foreach (['tr', 'en', 'es', 'de', 'fr'] as $l) {
                foreach (['title_'.$l, 'sub_'.$l] as $col) {
                    if (Schema::hasColumn('menu_items', $col)) {
                        $t->dropColumn($col);
                    }
                }
            }
        });
    }
};
