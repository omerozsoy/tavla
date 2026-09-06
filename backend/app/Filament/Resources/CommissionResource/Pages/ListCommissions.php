<?php

namespace App\Filament\Resources\CommissionResource\Pages;

use App\Filament\Resources\CommissionResource;
use Filament\Resources\Pages\ListRecords;

class ListCommissions extends ListRecords
{
    protected static string $resource = CommissionResource::class;

    // Ledger oyun motorunca yazılır; elle eklenmez -> "Oluştur" butonu yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
