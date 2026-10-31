<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin moderasyon işareti (şüpheli | sorunlu | küfürbaz). Profiline girmeden listeden
// tek tıkla atanır; satır kırmızı görünür. admin_note (serbest metin) ve cheat_suspect
// (otomatik motor şüphesi) ile karışmaz — bu ELLE kategorili bir işaret.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('admin_flag', 20)->nullable()->index()->after('admin_note_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('admin_flag');
        });
    }
};
