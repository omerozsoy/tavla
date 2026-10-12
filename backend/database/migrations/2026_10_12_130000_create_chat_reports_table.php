<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// KÜFÜR / SOHBET ŞİKAYETİ: oyuncu maç sohbetindeki "Şikayet Et" butonuna basınca o anki son 10
// sohbet satırı (tarafları belirtilerek) yönetime kaydedilir. Yönetim panelinde "Küfür Şikayetleri"
// sayfasında incelenir. Kayıtlar yalnız şikayetten oluşur (panelden eklenmez).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_reports', function (Blueprint $table) {
            $table->id();
            $table->string('room_code', 16)->index();
            $table->unsignedBigInteger('reporter_user_id')->nullable()->index();
            $table->string('reporter_name', 60)->nullable();   // şikayet eden (taraf)
            $table->string('reporter_slot', 4)->nullable();     // p1 / p2
            $table->string('reported_name', 60)->nullable();    // şikayet edilen (karşı taraf)
            $table->string('p1_name', 60)->nullable();
            $table->string('p2_name', 60)->nullable();
            $table->json('messages');                           // son 10 satır: [{slot,name,text}]
            $table->string('status', 16)->default('new');       // new / in_progress / resolved
            $table->text('admin_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_reports');
    }
};
