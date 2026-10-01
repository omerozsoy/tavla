<?php

namespace App\Filament\Resources\TournamentAnnouncementResource\Pages;

use App\Filament\Resources\TournamentAnnouncementResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditTournamentAnnouncement extends EditRecord
{
    protected static string $resource = TournamentAnnouncementResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
