<?php

namespace App\Filament\Resources\BugReportResource\Pages;

use App\Filament\Resources\BugReportResource;
use Filament\Resources\Pages\ListRecords;

class ListBugReports extends ListRecords
{
    protected static string $resource = BugReportResource::class;

    // Bildirimler yalniz kullanicidan gelir; panelden yeni olusturma yok -> header action yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
