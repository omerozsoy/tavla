<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Oda tipi etiketi: canli maclar listesinde "Mac Oyunu" (ranked/hizli eslesme) ile
// "Dostluk" (davet kodlu ozel oda) ayrimi icin. Null = eski kayit -> ranked varsayilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('mode', 16)->nullable()->after('target'); // 'ranked' | 'friendly'
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('mode');
        });
    }
};
