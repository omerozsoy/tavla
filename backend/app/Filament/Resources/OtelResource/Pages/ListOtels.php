<?php

namespace App\Filament\Resources\OtelResource\Pages;

use App\Filament\Resources\OtelResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListOtels extends ListRecords
{
    protected static string $resource = OtelResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\CreateAction::make()->label('Yeni otel')];
    }
}
