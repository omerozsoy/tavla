<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DM mesaj düzenleme: gönderen kendi mesajını 5 dk içinde düzenleyebilir; edited_at dolu ise
// arayüzde "(düzenlendi)" gösterilir. Nullable -> eski mesajlar etkilenmez.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->timestamp('edited_at')->nullable()->after('read_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropColumn('edited_at');
            });
        }
    }
};
