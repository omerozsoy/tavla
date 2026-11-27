<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

// SALT inceleme (Placeholder'lar read-only); kaydetme yok, yalniz Sil.
class EditPhotoAnalysis extends EditRecord
{
    protected static string $resource = PhotoAnalysisResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\DeleteAction::make()->label('Sil')];
    }

    // Placeholder'lar disinda form alani yok -> kaydet butonunu gizle.
    protected function getFormActions(): array
    {
        return [];
    }
}
