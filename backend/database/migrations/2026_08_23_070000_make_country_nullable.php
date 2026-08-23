<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // country zorunlu degil (kayitta bos gecilebilir) -> NOT NULL kaldir.
        // Onceden NOT NULL + default yok oldugundan bos ulke ile kayit 500 veriyordu.
        Schema::table('users', function (Blueprint $table) {
            $table->string('country')->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('country')->nullable(false)->default('')->change();
        });
    }
};
