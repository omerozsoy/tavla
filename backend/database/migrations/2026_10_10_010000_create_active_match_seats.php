<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// "İki oyunda birden" HARD GARANTİ: bir kullanıcı AYNI ANDA en fazla tek aktif maçta olabilir.
// user_id UNIQUE -> ikinci bir maça atomik "koltuk" INSERT'i veritabanı seviyesinde REDDEDİLİR
// (check-then-act yarışı imkansız). active_money_match_claims'in aynısı ama TÜM maçlar için
// (yalnız bahisli değil). room cascadeOnDelete -> oda silinince koltuk otomatik düşer.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('active_match_seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->timestamps();
            $table->unique('user_id');
            $table->index('room_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('active_match_seats');
    }
};
