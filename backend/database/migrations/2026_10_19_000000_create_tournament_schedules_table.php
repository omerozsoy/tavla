<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PERİYODİK TURNUVA ŞABLONU: haftanın seçilen günlerinde gece 00:00'da otomatik turnuva kuran
// tekrar kuralı. Tüm turnuva ayar kolonları birebir kopyalanır (CreateScheduledTournaments komutu
// bunları tournaments satırına yazar). weekdays = ISO gün no [1=Pzt .. 7=Paz]; start_time = o günün
// register_until saati (TR). last_created_on = aynı gün iki kez kurmayı önleyen gün damgası.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_schedules', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->boolean('active')->default(true);
            $t->json('weekdays');                 // [1..7] ISO gün numaraları
            $t->string('start_time', 5);          // "HH:MM" — o günkü register_until saati (TR)
            // ---- Kopyalanan turnuva ayarları (TournamentResource ile birebir) ----
            $t->string('type')->default('bracket');
            $t->string('venue', 160)->nullable();
            $t->unsignedBigInteger('organizer_id')->nullable();
            $t->integer('size')->default(8);
            $t->integer('match_length')->default(1);
            $t->integer('semi_length')->nullable();
            $t->integer('final_length')->nullable();
            $t->integer('round_minutes')->nullable();
            $t->integer('semi_minutes')->nullable();
            $t->integer('final_minutes')->nullable();
            $t->integer('prize_coins')->default(0);
            $t->json('prizes')->nullable();
            $t->string('prize_desc', 120)->nullable();
            $t->integer('entry_fee')->default(0);
            $t->boolean('premium_only')->default(true);
            $t->unsignedBigInteger('creator_id')->nullable();
            $t->date('last_created_on')->nullable(); // idempotency: bugün kuruldu mu?
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_schedules');
    }
};
