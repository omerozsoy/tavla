<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Footer bağlantı kolonları admin yapılandırması: 7 sabit kolon (game/community/content/
 * guide/organization/info/legal) SIRA + GÖRÜNÜRLÜK + BAŞLIK override (çok dilli). Kolon
 * ÖĞELERİ (linkler) hâlâ frontend'de (pages.ts + App); burada yalnız kolon başlığı/sırası/
 * görünürlüğü yönetilir. /api/footer-config ile okunur, App.tsx footerColumns'u buna göre dizer.
 */
return new class extends Migration
{
    /** Varsayılan kolonlar: key => [sort, tr başlık] (i18n foot.* ile aynı). */
    private const COLUMNS = [
        'game' => [0, 'Oyun'],
        'community' => [1, 'Topluluk'],
        'content' => [2, 'İçerik'],
        'guide' => [3, 'Eğitim'],
        'organization' => [4, 'Organizasyon'],
        'info' => [5, 'Bilgi'],
        'legal' => [6, 'Yasal'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('footer_columns')) {
            Schema::create('footer_columns', function (Blueprint $table) {
                $table->id();
                $table->string('key', 40)->unique();      // game|community|content|guide|organization|info|legal
                $table->string('label_tr', 80)->nullable(); // başlık override (boş = i18n varsayılanı)
                $table->string('label_en', 80)->nullable();
                $table->string('label_es', 80)->nullable();
                $table->string('label_de', 80)->nullable();
                $table->string('label_fr', 80)->nullable();
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('visible')->default(true);
                $table->timestamps();
            });
        }

        // 7 kolonu seed et (idempotent: firstOrCreate deseni). label_* NULL -> frontend i18n
        // varsayılanına düşer; admin doldurunca override olur (diğer diller otomatik çevrilir).
        foreach (self::COLUMNS as $key => [$sort, $tr]) {
            $exists = DB::table('footer_columns')->where('key', $key)->exists();
            if (! $exists) {
                DB::table('footer_columns')->insert([
                    'key' => $key,
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
        Schema::dropIfExists('footer_columns');
    }
};
