<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// products.category (string enum) -> product_categories ilişkisine geçiş.
// category_id ekle, eski string kategoriyi slug eşleşmesiyle backfill et, sonra string
// kolonu düşür (dinamik kategori tek kaynak).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('slug')
                ->constrained('product_categories')->nullOnDelete();
        });

        // Backfill: eski string kategori (products.category) -> ayni slug'a sahip kategori.
        if (Schema::hasColumn('products', 'category')) {
            $cats = DB::table('product_categories')->pluck('id', 'slug'); // slug => id
            foreach (DB::table('products')->get(['id', 'category']) as $p) {
                $id = $cats[$p->category] ?? $cats['diger'] ?? null;
                if ($id) {
                    DB::table('products')->where('id', $p->id)->update(['category_id' => $id]);
                }
            }
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('category', 40)->default('diger');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
        });
    }
};
