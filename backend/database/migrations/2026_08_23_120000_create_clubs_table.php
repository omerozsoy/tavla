<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kulupler + kulup uyelikleri (lig tablosu). Backgammon Galaxy tarzi:
// oyuncular bir kulube katilir, kulup ici lig puani biriktirir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clubs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('tag', 6)->nullable();          // kisa etiket (BGX)
            $table->string('description', 300)->nullable();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('members_count')->default(0);
            $table->unsignedInteger('points')->default(0);  // kulup toplam lig puani
            $table->timestamps();
        });

        Schema::create('club_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained('clubs')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 12)->default('member'); // owner | member
            $table->unsignedInteger('points')->default(0); // uyenin lig puani
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('losses')->default(0);
            $table->timestamps();
            $table->unique('user_id');   // bir oyuncu ayni anda tek kulupte
            $table->index('club_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_members');
        Schema::dropIfExists('clubs');
    }
};
