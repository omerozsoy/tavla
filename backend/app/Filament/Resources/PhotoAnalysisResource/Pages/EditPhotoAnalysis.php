<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use App\Models\PhotoAnalysis;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

/**
 * Admin incelemesi: fotografa bak -> tanima yanlissa dogru konumu (ground_truth) elle gir, Kaydet.
 * Birikien ground_truth != null satirlari (foto -> dogru konum) yeniden egitimin etiketli verisidir.
 */
class EditPhotoAnalysis extends EditRecord
{
    protected static string $resource = PhotoAnalysisResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\DeleteAction::make()->label('Sil')];
    }

    // ground_truth model'de dizi (cast) + Textarea string ister -> JSON metnine cevir. Bos ise admin
    // tanunan konumdan baslasin (yalniz yanlis noktalari duzeltir, sifirdan yazmaz).
    protected function mutateFormDataBeforeFill(array $data): array
    {
        $gt = $data['ground_truth'] ?? null;
        $data['ground_truth'] = json_encode($gt ?: ($data['position'] ?? null), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '';

        return $data;
    }

    // Textarea JSON metnini egitim etiketi dizisine cevir ('json' kurali gecerliligi garanti eder).
    // Admin konumu girdiyse ama inceleme durumunu secmediyse otomatik 'labeled' isaretle.
    protected function mutateFormDataBeforeSave(array $data): array
    {
        $data['ground_truth'] = PhotoAnalysis::parseGroundTruth($data['ground_truth'] ?? null);
        if ($data['ground_truth'] !== null && empty($data['review_status'])) {
            $data['review_status'] = 'labeled';
        }

        return $data;
    }
}
