<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * contents.show_tavlatv — Tavla Takvimi etkinlik kartinda TavlaTV yayin bayragini
 * goster/gizle. Varsayilan KAPALI (false); admin acinca kartin sag ust kosesinde
 * siyah TavlaTV flamasi asili gorunur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->boolean('show_tavlatv')->default(false)->after('published');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('show_tavlatv');
        });
    }
};
