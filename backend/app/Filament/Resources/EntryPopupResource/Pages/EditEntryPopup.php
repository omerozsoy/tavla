<?php

namespace App\Filament\Resources\EntryPopupResource\Pages;

use App\Filament\Resources\EntryPopupResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditEntryPopup extends EditRecord
{
    protected static string $resource = EntryPopupResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
