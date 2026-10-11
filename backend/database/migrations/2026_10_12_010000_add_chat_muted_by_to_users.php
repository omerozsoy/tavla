<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Konuşma yasağını HANGİ admin verdi (elle yasaklarda). Küfür filtresi otomatik yasaklarda null.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'chat_muted_by')) {
                $table->unsignedBigInteger('chat_muted_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('chat_muted_by');
        });
    }
};
