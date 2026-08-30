<?php

namespace App\Filament\Resources\MagazineResource\Pages;

use App\Filament\Resources\MagazineResource;
use Filament\Resources\Pages\CreateRecord;

class CreateMagazine extends CreateRecord
{
    protected static string $resource = MagazineResource::class;

    // Bu resource yalnizca magazin videolari yonetir; yeni kayit type='magazine' olsun.
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['type'] = 'magazine';

        return $data;
    }
}
