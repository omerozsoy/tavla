<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sohbet kapatma: oyunculardan biri oyun menusunden sohbeti kapatinca bu slot ('p1'/'p2')
// yazilir; null = sohbet acik. Kapaliyken iki taraf da mesaj gonderemez (yalniz kapatan geri acar).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('chat_off_by', 2)->nullable()->after('messages');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('chat_off_by');
        });
    }
};
