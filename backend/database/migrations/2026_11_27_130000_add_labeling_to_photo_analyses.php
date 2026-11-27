<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Foto analizi "kendini gelistiren" dongu: kullanici hatali taramayi bildirir (reported_at),
// admin resme bakip dogru konumu elle girer (ground_truth) -> yeniden egitim etiketi.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photo_analyses', function (Blueprint $table) {
            $table->timestamp('reported_at')->nullable()->index();   // kullanici "hatali tarama" bildirdi
            $table->json('ground_truth')->nullable();                // admin elle duzeltti (egitim etiketi)
            $table->string('review_status')->nullable()->index();    // null=incelenmedi | labeled | skipped
        });
    }

    public function down(): void
    {
        Schema::table('photo_analyses', function (Blueprint $table) {
            $table->dropColumn(['reported_at', 'ground_truth', 'review_status']);
        });
    }
};
