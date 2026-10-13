<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GammonTV'ye özel menü sadeleştirme: gammon domain'inde sayfa göster/gizle + grup ismi,
 * tavlatv'yi ETKİLEMEDEN. NULL = tavlatv'den miras (gammon_visible null -> visible kullanılır).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $t) {
            // null = miras (tavlatv visible), true/false = gammon'a özel override
            $t->boolean('gammon_visible')->nullable()->after('visible');
        });
        Schema::table('menu_groups', function (Blueprint $t) {
            $t->boolean('gammon_visible')->nullable()->after('visible');
            $t->string('gammon_label')->nullable()->after('label_en'); // gammon'a özel grup ismi (null -> label_en)
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $t) {
            $t->dropColumn('gammon_visible');
        });
        Schema::table('menu_groups', function (Blueprint $t) {
            $t->dropColumn(['gammon_visible', 'gammon_label']);
        });
    }
};
