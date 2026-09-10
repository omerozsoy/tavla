<?php

namespace App\Filament\Resources\CookieEntryResource\Pages;

use App\Filament\Resources\CookieEntryResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditCookieEntry extends EditRecord
{
    protected static string $resource = CookieEntryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
