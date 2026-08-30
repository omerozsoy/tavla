<?php

namespace App\Filament\Resources\MagazineResource\Pages;

use App\Filament\Resources\MagazineResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMagazines extends ListRecords
{
    protected static string $resource = MagazineResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
