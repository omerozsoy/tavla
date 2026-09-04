<?php

namespace App\Filament\Resources\MatchResultResource\Pages;

use App\Filament\Resources\MatchResultResource;
use Filament\Resources\Pages\ListRecords;

class ListMatchResults extends ListRecords
{
    protected static string $resource = MatchResultResource::class;

    // Sonuçlar oyun motorunca yazılır; elle eklenmez -> "Oluştur" butonu yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
