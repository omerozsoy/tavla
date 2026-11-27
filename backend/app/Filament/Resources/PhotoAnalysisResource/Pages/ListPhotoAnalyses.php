<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use Filament\Resources\Pages\ListRecords;

class ListPhotoAnalyses extends ListRecords
{
    protected static string $resource = PhotoAnalysisResource::class;

    // Kayitlar yalniz kullanici yuklemesinden -> panelden yeni olusturma yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
