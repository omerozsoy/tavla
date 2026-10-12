<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin notunu SON yazan yönetici + zaman (profilde/panelde "kim yazdı" küçük gösterilir).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'admin_note_by')) {
                $table->unsignedBigInteger('admin_note_by')->nullable();
            }
            if (! Schema::hasColumn('users', 'admin_note_at')) {
                $table->timestamp('admin_note_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['admin_note_by', 'admin_note_at']);
        });
    }
};
