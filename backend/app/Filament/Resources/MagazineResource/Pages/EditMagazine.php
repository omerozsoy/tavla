<?php

namespace App\Filament\Resources\MagazineResource\Pages;

use App\Filament\Resources\MagazineResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditMagazine extends EditRecord
{
    protected static string $resource = MagazineResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
