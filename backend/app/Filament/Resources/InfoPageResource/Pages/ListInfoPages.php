<?php

namespace App\Filament\Resources\InfoPageResource\Pages;

use App\Filament\Resources\InfoPageResource;
use Filament\Resources\Pages\ListRecords;

class ListInfoPages extends ListRecords
{
    protected static string $resource = InfoPageResource::class;

    // Sabit sayfalar; "Yeni" butonu yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
