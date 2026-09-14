<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kullanıcının seçili dijital checker (pul) materyali. null = varsayılan board pulu.
// Sahiplik unlocks JSON'da ('checker.<id>'); bu kolon yalnız AKTİF seçimi tutar (avatar_frame gibi).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'checker')) {
                $table->string('checker', 40)->nullable()->after('avatar_frame');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'checker')) {
                $table->dropColumn('checker');
            }
        });
    }
};
