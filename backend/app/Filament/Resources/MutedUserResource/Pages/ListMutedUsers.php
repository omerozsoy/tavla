<?php

namespace App\Filament\Resources\MutedUserResource\Pages;

use App\Filament\Resources\MutedUserResource;
use Filament\Resources\Pages\ListRecords;

class ListMutedUsers extends ListRecords
{
    protected static string $resource = MutedUserResource::class;

    // Yasaklılar yalnız sohbet yaptırımından gelir; panelden oluşturma yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
