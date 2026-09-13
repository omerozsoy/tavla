<?php

namespace Tests\Feature;

use App\Http\Controllers\ShopController;
use PHPUnit\Framework\TestCase;

/**
 * Board KATALOG PARİTESİ (citrus-wood satın alınamıyor bug'ı 2026-09-13):
 * Frontend src/boardThemes.ts'deki HER board (ÜCRETSİZ 'standart' hariç) backend
 * ShopController::BOARD_RARITY kataloğunda OLMALI. Aksi halde frontend fiyat gösterir ama
 * satın alma sunucuda REDDEDİLİR (theme.<id> geçersiz). Bu test o kaymayı derhal yakalar.
 */
class BoardCatalogParityTest extends TestCase
{
    /** src/boardThemes.ts içindeki tüm board id'leri (ALL_THEMES kaynağı, id: '...'). */
    private function frontendBoardIds(): array
    {
        $path = __DIR__.'/../../../src/boardThemes.ts';
        $this->assertFileExists($path, 'boardThemes.ts bulunamadı (repo yapısı değişti mi?)');
        $src = file_get_contents($path);
        preg_match_all("/id:\s*'([a-z0-9-]+)'/", $src, $m);

        return array_values(array_unique($m[1]));
    }

    public function test_every_purchasable_frontend_board_is_in_backend_catalog(): void
    {
        // FREE_BOARDS (boardThemes.ts) — ücretsiz boardlar katalogda OLMAZ. Şu an yalnız 'standart'.
        $free = ['standart'];
        $catalog = ShopController::boardThemeIds();

        $missing = [];
        foreach ($this->frontendBoardIds() as $id) {
            if (in_array($id, $free, true)) {
                continue;
            }
            if (! in_array($id, $catalog, true)) {
                $missing[] = $id;
            }
        }

        $this->assertSame([], $missing, 'Backend kataloğunda EKSİK board(lar) -> satın alınamaz: '.implode(', ', $missing));
    }

    public function test_backend_catalog_has_no_dead_board_ids(): void
    {
        $frontend = $this->frontendBoardIds();
        $dead = array_values(array_diff(ShopController::boardThemeIds(), $frontend));
        $this->assertSame([], $dead, 'Frontend\'de OLMAYAN ölü katalog kaydı: '.implode(', ', $dead));
    }
}
