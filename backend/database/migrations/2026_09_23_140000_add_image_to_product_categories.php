<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ürün kategorilerine kapak görseli. Mağaza vitrinindeki kategori kartlarında gösterilir
// (yoksa o kategorideki ilk ürünün görseli, o da yoksa ikon). Disk 'uploads' (dir 'kategori').
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('product_categories', 'image')) {
                $table->string('image')->nullable()->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_categories', function (Blueprint $table) {
            if (Schema::hasColumn('product_categories', 'image')) {
                $table->dropColumn('image');
            }
        });
    }
};
