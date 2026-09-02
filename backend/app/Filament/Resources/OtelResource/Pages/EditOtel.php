<?php

namespace App\Filament\Resources\OtelResource\Pages;

use App\Filament\Resources\OtelResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditOtel extends EditRecord
{
    protected static string $resource = OtelResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\DeleteAction::make()->label('Sil')];
    }
}
