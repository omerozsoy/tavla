<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

// SALT İNCELEME: tanıma/konum/hint/etiket read-only gösterilir. Gerçek düzeltme React SPA'da
// (liste "Düzelt" -> /foto-duzelt/<id>, gerçek Board). Bu sayfada kaydetme yok.
class EditPhotoAnalysis extends EditRecord
{
    protected static string $resource = PhotoAnalysisResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\DeleteAction::make()->label('Sil')];
    }

    // Tüm alanlar Placeholder (read-only) -> kaydet butonu yok.
    protected function getFormActions(): array
    {
        return [];
    }
}
