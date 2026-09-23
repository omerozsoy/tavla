<?php

namespace App\Filament\Resources\MakaleResource\Pages;

use App\Filament\Resources\MakaleResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditMakale extends EditRecord
{
    protected static string $resource = MakaleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
