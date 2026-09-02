<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * contents.links — kulup sosyal medya/web baglantilari (JSON):
 * { "instagram": "...", "youtube": "...", "website": "..." }. Rehberde ikon-link olarak gosterilir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->json('links')->nullable()->after('contact');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('links');
        });
    }
};
