<?php

namespace App\Filament\Resources\FooterColumnResource\Pages;

use App\Filament\Resources\FooterColumnResource;
use Filament\Resources\Pages\ListRecords;

class ListFooterColumns extends ListRecords
{
    protected static string $resource = FooterColumnResource::class;

    // 7 sabit kolon: "Yeni" başlık aksiyonu yok (reorder + inline düzenleme).
    protected function getHeaderActions(): array
    {
        return [];
    }
}
