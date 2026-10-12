<?php

namespace App\Filament\Resources\ChatReportResource\Pages;

use App\Filament\Resources\ChatReportResource;
use Filament\Resources\Pages\ListRecords;

class ListChatReports extends ListRecords
{
    protected static string $resource = ChatReportResource::class;

    // Şikayetler yalnız oyunculardan gelir; panelden yeni oluşturma yok -> header action yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
