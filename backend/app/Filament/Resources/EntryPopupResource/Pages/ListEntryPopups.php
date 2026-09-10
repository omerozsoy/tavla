<?php

namespace App\Filament\Resources\EntryPopupResource\Pages;

use App\Filament\Resources\EntryPopupResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListEntryPopups extends ListRecords
{
    protected static string $resource = EntryPopupResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
