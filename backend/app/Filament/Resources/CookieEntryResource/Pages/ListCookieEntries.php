<?php

namespace App\Filament\Resources\CookieEntryResource\Pages;

use App\Filament\Resources\CookieEntryResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListCookieEntries extends ListRecords
{
    protected static string $resource = CookieEntryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
