<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// match_results'a oynanan coin bahsini (snapshot) ekler. Eskiden "Oynanan bahis" admin
// panelde rooms.stake'ten okunuyordu; bitmiş oda purge edilince (tavla:purge-old-matches)
// stake kayboluyor, gerçek coin maçı "—" görünüyordu. Artık settle anında buraya kopyalanır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            if (! Schema::hasColumn('match_results', 'stake')) {
                $table->unsignedBigInteger('stake')->nullable()->after('coins_after'); // oda silinse de kalır
            }
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            if (Schema::hasColumn('match_results', 'stake')) {
                $table->dropColumn('stake');
            }
        });
    }
};
