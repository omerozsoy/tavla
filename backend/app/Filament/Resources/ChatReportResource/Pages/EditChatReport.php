<?php

namespace App\Filament\Resources\ChatReportResource\Pages;

use App\Filament\Resources\ChatReportResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditChatReport extends EditRecord
{
    protected static string $resource = ChatReportResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
