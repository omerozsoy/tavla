<?php

namespace App\Filament\Resources\ContactMessageResource\Pages;

use App\Filament\Resources\ContactMessageResource;
use Filament\Resources\Pages\ListRecords;

class ListContactMessages extends ListRecords
{
    protected static string $resource = ContactMessageResource::class;

    // Talepler yalniz formdan gelir; panelden yeni olusturma yok -> header action yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
