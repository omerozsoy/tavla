<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('info_pages', function (Blueprint $table) {
            // İsimli galeriler: [{ name: 'turnuvalar', images: [...] }, ...]
            // İçerikte <name> yazılan yere ilgili galeri konur. Tekli 'gallery' (<resimgalerisi>) korunur.
            $table->json('galleries')->nullable()->after('gallery');
        });
    }

    public function down(): void
    {
        Schema::table('info_pages', function (Blueprint $table) {
            $table->dropColumn('galleries');
        });
    }
};
