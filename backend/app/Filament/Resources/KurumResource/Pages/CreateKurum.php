<?php

namespace App\Filament\Resources\KurumResource\Pages;

use App\Filament\Resources\KurumResource;
use Filament\Resources\Pages\CreateRecord;

class CreateKurum extends CreateRecord
{
    protected static string $resource = KurumResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['type'] = 'kurum';
        return $data;
    }
}
