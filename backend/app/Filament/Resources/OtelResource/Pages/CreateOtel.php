<?php

namespace App\Filament\Resources\OtelResource\Pages;

use App\Filament\Resources\OtelResource;
use Filament\Resources\Pages\CreateRecord;

class CreateOtel extends CreateRecord
{
    protected static string $resource = OtelResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['type'] = 'otel';
        return $data;
    }
}
