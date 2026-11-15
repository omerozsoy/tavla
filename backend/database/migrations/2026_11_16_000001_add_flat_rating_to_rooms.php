<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// TURNUVA/LİG sabit-±delta bayrağı (Elo DEĞİL). Eskiden tespit YALNIZ roomTargetKey cache'iydi
// (2 gün TTL); backstop sweep de 2 güne kadar eski odayı tarıyor -> sınırda cache expire olup bir
// taraf Elo diğeri sabit-±10 alıyordu (tekrarlayan asimetri sınıfı). Oda ENTER'da (cache tazeyken)
// bu kolon kalıcı yazılır -> settlement artık cache'e bağlı değil, pencere kapanır. RatingPolicy::
// isTournament kolon VEYA cache (geçişte, kolonsuz eski odalar için) okur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('flat_rating')->default(false)->after('unrated');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('flat_rating');
        });
    }
};
