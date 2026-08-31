<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner (Christie's split hero) sol panelde CTA'nin ustunde kucuk meta satiri
// (ör. tarih · yer). Bos birakilirsa gosterilmez.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->string('meta', 120)->nullable()->after('subtitle');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
    }
};
