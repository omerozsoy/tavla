<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DM'lerde resim gönderme: mesaja opsiyonel base64 data-URL görsel (avatar ile aynı desen,
// daha büyük limit). body ile birlikte VEYA tek başına (yalnız görsel) olabilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->longText('image')->nullable()->after('body'); // data:image/...;base64,...
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('image');
        });
    }
};
