<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuva Tipi: 'bracket' = klasik eleme ağacı (bugüne kadarki tek tip) / 'swiss_triple' = Swiss
// Triple Elimination (kuralları sonra tanımlanacak; şimdilik yalnız seçenek + saklama).
// Varsayılan 'bracket': mevcut tüm turnuvalar bugünkü davranışı korur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'type')) {
                $t->string('type', 32)->default('bracket')->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'type')) {
                $t->dropColumn('type');
            }
        });
    }
};
