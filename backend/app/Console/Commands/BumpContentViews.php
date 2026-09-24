<?php

namespace App\Console\Commands;

use App\Models\Content;
use Illuminate\Console\Command;

/**
 * MAKALE/HABER OKUNMASI ORGANİK ARTIŞ: yayındaki makale + haber okunma sayaçlarını zamanla
 * kendiliğinden (küçük rastgele adımlarla) artırır -> yazılar "canlı" görünsün, sayaç yalnız
 * gerçek detay-açılışına (POST /contents/{id}/view) bağlı kalmasın.
 *
 * DOĞAL HİS: artış yaşa göre ölçeklenir (yeni yazı daha hızlı, eskiler yavaşlar / platoya oturur)
 * + her koşuda her yazıya rastgele 0..N eklenir (hepsi aynı anda oynamaz). Saatte bir çalışacak
 * şekilde tasarlandı (routes/console.php ->hourly); tek koşu maliyeti ~30 küçük UPDATE.
 *
 * Idempotent değildir (her koşu birikimlidir) ama withoutOverlapping + saatlik ritimle güvenli.
 */
class BumpContentViews extends Command
{
    protected $signature = 'contents:bump-views {--dry : Yazmadan ne ekleneceğini raporla}';

    protected $description = 'Yayındaki makale/haber okunma sayaçlarını zamanla organik (yaşa göre azalan) rastgele adımlarla artırır.';

    public function handle(): int
    {
        $now = now();
        $dry = (bool) $this->option('dry');
        $rows = Content::query()
            ->whereIn('type', ['makale', 'news'])
            ->where('published', true)
            ->get();

        $touched = 0;
        $total = 0;
        foreach ($rows as $c) {
            $ref = $c->event_at ?? $c->created_at ?? $now;
            $ageDays = $ref->diffInDays($now);

            // Yaşa göre saatlik maksimum artış: taze yazı hızlı, eski yazı yavaş plato.
            $bump = match (true) {
                $ageDays <= 3 => random_int(0, 3),   // ilk 3 gün: 0-3/saat (~ort. 36/gün)
                $ageDays <= 14 => random_int(0, 2),   // 2 hafta: 0-2/saat (~ort. 24/gün)
                $ageDays <= 60 => random_int(0, 1),   // 2 ay: 0-1/saat (~ort. 12/gün)
                default => random_int(1, 5) === 1 ? 1 : 0, // eskiler: %20 ihtimalle +1 (~5/gün)
            };
            if ($bump <= 0) {
                continue;
            }
            $total += $bump;
            $touched++;
            if (! $dry) {
                // increment atomik; updated_at'e dokunma (liste event_at/created_at'e göre sıralanır,
                // ama gereksiz updated_at oynamasın -> sıralama/ETag kararlı kalsın).
                $c->timestamps = false;
                $c->increment('views', $bump);
            }
        }

        $this->info(($dry ? '[DRY] ' : '')."Okunma artışı: {$touched}/{$rows->count()} yazı, +{$total} toplam okunma.");

        return self::SUCCESS;
    }
}
