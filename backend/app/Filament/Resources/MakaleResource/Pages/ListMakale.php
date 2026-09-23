<?php

namespace App\Filament\Resources\MakaleResource\Pages;

use App\Filament\Resources\MakaleResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMakale extends ListRecords
{
    protected static string $resource = MakaleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label('Yeni makale'),
        ];
    }
}
