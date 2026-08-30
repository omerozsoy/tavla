<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hata Gunlugu: match_results.log'dan cikarilmis KARAR BASINA analiz.
        // Kaynak equity/best/loss zaten log'da (tarayici WildBG). Burada ayrica
        // pozisyon siniflandirmasi (17 kategori) + siddet + pip saklanir; boylece
        // gunluk kategori/error-rate SQL ile hizli toplanir.
        Schema::create('decision_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('match_result_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('move_index');       // mac icindeki karar sirasi
            $table->timestamp('played_at')->nullable();       // filtre icin (mac tarihi)

            $table->string('player', 8);                      // 'white' | 'black'
            $table->string('decision_type', 8)->default('checker'); // checker | cube
            $table->string('dice', 8)->nullable();            // "6-3"

            $table->string('played', 40)->nullable();         // oynanan hamle notasyonu
            $table->string('best', 40)->nullable();           // en iyi hamle notasyonu
            $table->float('played_equity')->nullable();
            $table->float('best_equity')->nullable();
            $table->float('equity_loss');                     // bestEquity - playedEquity

            // null = hata degil (perfect, <0.02). Karar yine saklanir (errorRate paydasi).
            $table->string('severity', 12)->nullable();       // inaccuracy | mistake | blunder
            $table->string('primary_category', 24);           // 17 kategoriden biri
            $table->json('category_tags')->nullable();        // secondary tag'ler

            $table->unsignedSmallInteger('my_pip')->nullable();
            $table->unsignedSmallInteger('opp_pip')->nullable();

            // Board onizleme + ok cizimi icin (frontend MiniBoard) — buyuk olabilir.
            $table->longText('pos')->nullable();              // GameState JSON
            $table->longText('steps')->nullable();            // en iyi hamle Step[] JSON
            $table->longText('played_steps')->nullable();     // oynanan hamle Step[] JSON
            $table->longText('cands')->nullable();            // alternatif ilk N hamle JSON

            $table->string('engine_version', 16)->nullable();
            $table->unsignedSmallInteger('analysis_version')->default(1);

            $table->timestamps();

            // Deterministic uniqueness: ayni mac tekrar islenirse duplicate uretme.
            $table->unique(['match_result_id', 'move_index']);
            // Gunluk filtre + kategori kirilimi icin.
            $table->index(['user_id', 'played_at']);
            $table->index(['user_id', 'primary_category']);
        });

        // Bir macin islenip islenmedigi (backfill/incremental icin isaret).
        Schema::table('match_results', function (Blueprint $table) {
            $table->timestamp('analyzed_at')->nullable();
            $table->unsignedSmallInteger('analysis_version')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['analyzed_at', 'analysis_version']);
        });
        Schema::dropIfExists('decision_analyses');
    }
};
