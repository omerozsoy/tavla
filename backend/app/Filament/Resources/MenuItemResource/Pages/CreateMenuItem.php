<?php

namespace App\Filament\Resources\MenuItemResource\Pages;

use App\Filament\Resources\MenuItemResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateMenuItem extends CreateRecord
{
    protected static string $resource = MenuItemResource::class;

    // Özel öğe: benzersiz key üret + custom=true işaretle (katalog öğeleriyle çakışmasın,
    // syncCatalog onu silmesin/ezmesin). label_tr çevirileri model booted() saving'de dolar.
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['custom'] = true;
        $data['key'] = 'custom-'.Str::lower(Str::random(10));

        return $data;
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
