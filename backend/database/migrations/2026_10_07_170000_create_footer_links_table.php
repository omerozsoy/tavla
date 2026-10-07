<?php

use App\Models\FooterLink;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Footer bağlantıları admin yapılandırması: bir kolonun İÇİNDEKİ linklerin SIRA + GÖRÜNÜRLÜK +
 * BAŞLIK override'ı (çok dilli). Kolon başlığı/sırası footer_columns'ta; bu tablo kolon öğelerini
 * yönetir. /api/footer-config ile okunur; App.tsx her kolonun öğelerini buna göre dizer/gizler.
 * Seed: FooterLink::ITEMS (frontend footer öğe key'leriyle birebir), kolon içi sıra = index.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('footer_links')) {
            Schema::create('footer_links', function (Blueprint $table) {
                $table->id();
                $table->string('item_key', 64)->unique();   // frontend footer öğe key'i (pages.ts / App.tsx)
                $table->string('column_key', 40);           // game|community|content|guide|organization|info|legal
                $table->string('label_tr', 120)->nullable(); // başlık override (boş = frontend varsayılanı)
                $table->string('label_en', 120)->nullable();
                $table->string('label_es', 120)->nullable();
                $table->string('label_de', 120)->nullable();
                $table->string('label_fr', 120)->nullable();
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('visible')->default(true);
                $table->timestamps();
            });
        }

        // Seed (idempotent): her öğeyi kolon içindeki konumuna (sort) yerleştir. label_* NULL ->
        // frontend kendi varsayılan etiketini kullanır; admin doldurursa override olur.
        $perColumn = [];
        foreach (FooterLink::ITEMS as $it) {
            $col = $it['column'];
            $sort = $perColumn[$col] ?? 0;
            $perColumn[$col] = $sort + 1;
            if (! DB::table('footer_links')->where('item_key', $it['key'])->exists()) {
                DB::table('footer_links')->insert([
                    'item_key' => $it['key'],
                    'column_key' => $col,
                    'sort' => $sort,
                    'visible' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('footer_links');
    }
};
