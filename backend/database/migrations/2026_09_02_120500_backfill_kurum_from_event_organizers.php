<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mevcut Takvim etkinliklerindeki serbest-metin "organizer" adlarindan Kurum
 * (Content type='kurum') kayitlari uretir. Isimler birebir korunur; boylece
 * EventResource'taki Kurumlar-secici mevcut etkinlikleri otomatik esler.
 * Idempotent: zaten kurum olan ad tekrar eklenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        $organizers = DB::table('contents')
            ->where('type', 'event')
            ->whereNotNull('organizer')
            ->where('organizer', '!=', '')
            ->distinct()
            ->pluck('organizer');

        $existing = DB::table('contents')
            ->where('type', 'kurum')
            ->pluck('title')
            ->all();
        $existing = array_map('mb_strtolower', $existing);

        $now = now();
        foreach ($organizers as $name) {
            $name = trim((string) $name);
            if ($name === '' || in_array(mb_strtolower($name), $existing, true)) {
                continue;
            }
            DB::table('contents')->insert([
                'type' => 'kurum',
                'title' => $name,
                'published' => true,
                'sort' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $existing[] = mb_strtolower($name);
        }
    }

    public function down(): void
    {
        // Geri alinmaz: elle eklenen kurumlarla karisir. Kasitli olarak no-op.
    }
};
