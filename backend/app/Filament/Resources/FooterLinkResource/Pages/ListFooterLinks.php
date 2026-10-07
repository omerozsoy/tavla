<?php

namespace App\Filament\Resources\FooterLinkResource\Pages;

use App\Filament\Resources\FooterLinkResource;
use Filament\Resources\Pages\ListRecords;

class ListFooterLinks extends ListRecords
{
    protected static string $resource = FooterLinkResource::class;

    // Sabit set: "Yeni" aksiyonu yok (reorder + inline düzenleme).
    protected function getHeaderActions(): array
    {
        return [];
    }
}
