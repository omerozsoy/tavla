<?php

namespace App\Filament\Resources\KurumResource\Pages;

use App\Filament\Resources\KurumResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditKurum extends EditRecord
{
    protected static string $resource = KurumResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\DeleteAction::make()->label('Sil')];
    }
}
