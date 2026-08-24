<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            // Haber detayindaki ek gorseller (kapak disinda): JSON dizi ["/news/x.jpg", ...]
            $table->text('gallery')->nullable()->after('image');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('gallery');
        });
    }
};
